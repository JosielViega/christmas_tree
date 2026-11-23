<?php

declare(strict_types=1);

namespace Tests;

use App\Controllers\TreeOrnamentApiController;
use App\Core\Csrf;
use App\Core\Request;
use App\Core\Session;
use App\Services\ChristmasTreeIdentityService;
use App\Services\ChristmasTreeOrnamentService;
use App\Services\RateLimiter;
use App\Services\TreeOwnerSession;
use App\Services\VisitorIdentityService;
use App\Services\MessageReleasePolicy;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeOrnamentRepository;
use Tests\Support\InMemoryChristmasTreeRepository;
use Tests\Support\InMemoryVisitorIdentityRepository;

final class TreeOrnamentApiControllerTest extends TestCase
{
    private string $rateLimitDirectory;
    private Session $session;
    private Csrf $csrf;
    private ChristmasTreeIdentityService $trees;
    private ChristmasTreeOrnamentService $ornaments;
    private TreeOwnerSession $ownerSession;
    private InMemoryChristmasTreeRepository $treeRepository;
    private InMemoryChristmasTreeOrnamentRepository $ornamentRepository;
    private VisitorIdentityService $visitorIdentity;

    protected function setUp(): void
    {
        $_SESSION = [];
        $this->rateLimitDirectory = sys_get_temp_dir() . '/ornament-rate-limit-' . bin2hex(random_bytes(6));
        $this->treeRepository = new InMemoryChristmasTreeRepository();
        $this->ornamentRepository = new InMemoryChristmasTreeOrnamentRepository();
        $this->session = new Session(false);
        $this->csrf = new Csrf($this->session);
        $this->trees = new ChristmasTreeIdentityService($this->treeRepository);
        $this->ornaments = new ChristmasTreeOrnamentService($this->treeRepository, $this->ornamentRepository);
        $this->ownerSession = new TreeOwnerSession($this->session);
        $this->visitorIdentity = new VisitorIdentityService(new InMemoryVisitorIdentityRepository());
    }

    protected function tearDown(): void
    {
        if (!is_dir($this->rateLimitDirectory)) {
            return;
        }
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($this->rateLimitDirectory, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );
        foreach ($iterator as $item) {
            $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }
        rmdir($this->rateLimitDirectory);
    }

    public function testAddsListsAndDeduplicatesValidOrnament(): void
    {
        $tree = $this->trees->create('Cecília')->tree;
        $request = $this->mutableRequest('POST', ['ornament_type' => 'heart', 'sender_name' => 'João', 'message' => 'Feliz Natal!'], str_repeat('a', 16));
        $created = $this->controller($request)->store($tree->publicId);
        $payload = json_decode($created->body(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(201, $created->status());
        self::assertTrue($payload['data']['created']);
        self::assertSame('heart', $payload['data']['ornament']['ornament_type']);
        self::assertArrayNotHasKey('tree_id', $payload['data']['ornament']);
        self::assertStringNotContainsString('Feliz Natal!', $created->body());

        $cookie = $this->visitorCookie($created);
        self::assertStringNotContainsString($cookie, $created->body());
        self::assertStringContainsString('HttpOnly', $created->headers()['Set-Cookie']);
        self::assertStringContainsString('SameSite=Lax', $created->headers()['Set-Cookie']);
        $repeatedRequest = $this->mutableRequest(
            'POST',
            ['ornament_type' => 'heart', 'sender_name' => 'João', 'message' => 'Feliz Natal!'],
            str_repeat('a', 16),
            ['christmas_tree_visitor' => $cookie],
        );
        $repeated = $this->controller($repeatedRequest)->store($tree->publicId);
        self::assertSame(200, $repeated->status());
        self::assertStringContainsString('"created":false', $repeated->body());

        $conflict = $this->controller($this->mutableRequest('POST', [
            'ornament_type' => 'heart', 'sender_name' => 'João', 'message' => 'Mensagem alterada',
        ], str_repeat('a', 16), ['christmas_tree_visitor' => $cookie]))->store($tree->publicId);
        self::assertSame(409, $conflict->status());
        self::assertStringContainsString('idempotency_conflict', $conflict->body());
        self::assertStringNotContainsString('Feliz Natal!', $conflict->body());

        $listed = $this->controller(new Request(cookies: ['christmas_tree_visitor' => $cookie]))->index($tree->publicId);
        self::assertSame(200, $listed->status());
        self::assertStringContainsString($payload['data']['ornament']['public_id'], $listed->body());
        self::assertStringNotContainsString('Feliz Natal!', $listed->body());
        self::assertStringContainsString('"current_visitor_has_decorated":true', $listed->body());
        self::assertSame('private, no-store, max-age=0', $listed->headers()['Cache-Control']);
    }

    public function testRejectsInvalidCsrfTypeNameAndOversizedPayload(): void
    {
        $tree = $this->trees->create('Cecília')->tree;
        $invalidCsrf = new Request(parsedBody: [], server: [
            'REQUEST_METHOD' => 'POST', 'CONTENT_LENGTH' => 50, 'REMOTE_ADDR' => '127.0.0.1', 'HTTP_X_CSRF_TOKEN' => 'invalid',
        ]);
        self::assertSame(419, $this->controller($invalidCsrf)->store($tree->publicId)->status());

        $invalidData = $this->mutableRequest('POST', ['ornament_type' => 'invalid', 'sender_name' => 'x', 'message' => ''], str_repeat('b', 16));
        self::assertSame(422, $this->controller($invalidData)->store($tree->publicId)->status());

        $oversized = new Request(parsedBody: [], server: [
            'REQUEST_METHOD' => 'POST', 'CONTENT_LENGTH' => 4097, 'REMOTE_ADDR' => '127.0.0.1', 'HTTP_X_CSRF_TOKEN' => $this->csrf->token(),
        ]);
        self::assertSame(413, $this->controller($oversized)->store($tree->publicId)->status());
    }

    public function testMissingTreeAndRateLimitReturnStandardErrors(): void
    {
        $request = $this->mutableRequest('POST', ['ornament_type' => 'star', 'sender_name' => 'Lia', 'message' => 'Boas festas'], str_repeat('c', 16));
        self::assertSame(404, $this->controller($request)->store('AbCdEf1234_-')->status());

        $tree = $this->trees->create('Cecília')->tree;
        self::assertSame(201, $this->controller($request, 2)->store($tree->publicId)->status());
        $limited = $this->controller($this->mutableRequest('POST', ['ornament_type' => 'heart', 'sender_name' => 'Bia', 'message' => 'Feliz Natal'], str_repeat('d', 16)), 2)
            ->store($tree->publicId);
        self::assertSame(429, $limited->status());
    }

    public function testOnlyOwnerCanDeleteAndDeletionIsScopedToTree(): void
    {
        $creation = $this->trees->create('Cecília');
        $otherCreation = $this->trees->create('Outra');
        $stored = $this->controller($this->mutableRequest('POST', ['ornament_type' => 'star', 'sender_name' => 'Leo', 'message' => 'Com carinho'], str_repeat('e', 16)))
            ->store($creation->tree->publicId);
        $ornamentId = json_decode($stored->body(), true, 512, JSON_THROW_ON_ERROR)['data']['ornament']['public_id'];

        $deleteRequest = $this->mutableRequest('DELETE');
        self::assertSame(403, $this->controller($deleteRequest)->destroy($creation->tree->publicId, $ornamentId)->status());

        $this->ownerSession->grant($creation->tree->publicId, $creation->adminToken);
        $this->ownerSession->grant($otherCreation->tree->publicId, $otherCreation->adminToken);
        self::assertSame(404, $this->controller($deleteRequest)->destroy($otherCreation->tree->publicId, $ornamentId)->status());
        self::assertSame(200, $this->controller($deleteRequest)->destroy($creation->tree->publicId, $ornamentId)->status());
        self::assertSame(404, $this->controller($deleteRequest)->destroy($creation->tree->publicId, $ornamentId)->status());
    }

    public function testOwnerCannotDecorateOwnTreeButCanDecorateFriendsTree(): void
    {
        $owner = $this->trees->create('Proprietária');
        $friend = $this->trees->create('Amiga');
        $this->ownerSession->grant($owner->tree->publicId, $owner->adminToken);

        $own = $this->controller($this->mutableRequest('POST', [
            'ornament_type' => 'heart', 'sender_name' => 'Proprietária', 'message' => 'Minha mensagem',
        ], str_repeat('q', 16)))->store($owner->tree->publicId);
        self::assertSame(403, $own->status());
        self::assertStringContainsString('owner_cannot_decorate', $own->body());

        $friends = $this->controller($this->mutableRequest('POST', [
            'ornament_type' => 'heart', 'sender_name' => 'Visitante', 'message' => 'Boas festas',
        ], str_repeat('r', 16)))->store($friend->tree->publicId);
        self::assertSame(201, $friends->status());
    }

    public function testPersistentlyRestoredOwnerCannotDecorateOwnTree(): void
    {
        $owner = $this->trees->create('Proprietária persistente');
        $this->ownerSession->grantPersistent($owner->tree->publicId);

        $response = $this->controller($this->mutableRequest('POST', [
            'ornament_type' => 'star', 'sender_name' => 'Proprietária', 'message' => 'Tentativa própria',
        ], str_repeat('s', 16)))->store($owner->tree->publicId);

        self::assertSame(403, $response->status());
        self::assertStringContainsString('owner_cannot_decorate', $response->body());
    }

    public function testPrivateMessagesRequireOwnerAndRemainLockedWithoutLeakingContent(): void
    {
        $creation = $this->trees->create('Cecília');
        $secret = 'Conteúdo super secreto 🎁';
        $stored = $this->controller($this->mutableRequest('POST', [
            'ornament_type' => 'star', 'sender_name' => 'Lia', 'message' => $secret,
        ], str_repeat('m', 16)))->store($creation->tree->publicId);
        self::assertSame(201, $stored->status());

        $lockedService = $this->messageServiceAt('2026-12-25T02:59:59+00:00');
        $unauthorized = $this->controller(new Request(), 50, $lockedService)->messages($creation->tree->publicId);
        self::assertSame(403, $unauthorized->status());
        self::assertStringNotContainsString($secret, $unauthorized->body());

        $this->ownerSession->grant($creation->tree->publicId, $creation->adminToken);
        $locked = $this->controller(new Request(), 50, $lockedService)->messages($creation->tree->publicId);
        self::assertSame(423, $locked->status());
        self::assertStringContainsString('messages_locked', $locked->body());
        self::assertStringContainsString('"message_count":1', $locked->body());
        self::assertStringNotContainsString($secret, $locked->body());
        self::assertSame('private, no-store, max-age=0', $locked->headers()['Cache-Control']);
    }

    public function testOwnerReceivesOnlyOwnTreeMessagesAtExactRevealInstant(): void
    {
        $first = $this->trees->create('Primeira');
        $second = $this->trees->create('Segunda');
        $this->ornaments->create($first->tree->publicId, 'heart', 'Ana', str_repeat('n', 16), 'Mensagem primeira');
        $this->ornaments->create($second->tree->publicId, 'star', 'Bia', str_repeat('o', 16), 'Mensagem segunda');
        $this->ownerSession->grant($first->tree->publicId, $first->adminToken);

        $revealedService = $this->messageServiceAt('2026-12-25T03:00:00+00:00');
        $response = $this->controller(new Request(), 50, $revealedService)->messages($first->tree->publicId);

        self::assertSame(200, $response->status());
        self::assertStringContainsString('Mensagem primeira', $response->body());
        self::assertStringNotContainsString('Mensagem segunda', $response->body());
        self::assertSame('private, no-store, max-age=0', $response->headers()['Cache-Control']);

        $otherTree = $this->controller(new Request(), 50, $revealedService)->messages($second->tree->publicId);
        self::assertSame(403, $otherTree->status());
        self::assertStringNotContainsString('Mensagem segunda', $otherTree->body());
    }

    public function testManualReleaseReturnsHttp200AndDisablingReturnsToHttp423(): void
    {
        $creation = $this->trees->create('Cecília');
        $this->ornaments->create($creation->tree->publicId, 'heart', 'Ana', str_repeat('q', 16), 'Mensagem temporariamente liberada');
        $this->ownerSession->grant($creation->tree->publicId, $creation->adminToken);

        $released = $this->controller(new Request(), 50, $this->messageServiceAt('2026-11-01T00:00:00+00:00', true))
            ->messages($creation->tree->publicId);
        self::assertSame(200, $released->status());
        self::assertStringContainsString('Mensagem temporariamente liberada', $released->body());

        $lockedAgain = $this->controller(new Request(), 50, $this->messageServiceAt('2026-11-01T00:00:00+00:00', false))
            ->messages($creation->tree->publicId);
        self::assertSame(423, $lockedAgain->status());
        self::assertStringNotContainsString('Mensagem temporariamente liberada', $lockedAgain->body());
    }

    public function testLimitsOneFreeOrnamentPerVisitorAndTreeEvenAfterOwnerDeletion(): void
    {
        $firstTree = $this->trees->create('Maria');
        $secondTree = $this->trees->create('Ana');
        $first = $this->controller($this->mutableRequest('POST', [
            'ornament_type' => 'heart', 'sender_name' => 'Mesmo nome', 'message' => 'Primeira mensagem',
        ], str_repeat('v', 16)))->store($firstTree->tree->publicId);
        $cookie = $this->visitorCookie($first);

        $duplicate = $this->controller($this->mutableRequest('POST', [
            'ornament_type' => 'star', 'sender_name' => 'Outro nome', 'message' => 'Segunda mensagem',
        ], str_repeat('w', 16), ['christmas_tree_visitor' => $cookie]))->store($firstTree->tree->publicId);
        self::assertSame(409, $duplicate->status());
        self::assertStringContainsString('visitor_already_decorated', $duplicate->body());

        $otherTree = $this->controller($this->mutableRequest('POST', [
            'ornament_type' => 'star', 'sender_name' => 'Mesmo nome', 'message' => 'Outra árvore',
        ], str_repeat('x', 16), ['christmas_tree_visitor' => $cookie]))->store($secondTree->tree->publicId);
        self::assertSame(201, $otherTree->status());

        $ornamentId = json_decode($first->body(), true, 512, JSON_THROW_ON_ERROR)['data']['ornament']['public_id'];
        self::assertTrue($this->ornaments->delete($firstTree->tree->publicId, $ornamentId));
        $afterDeletion = $this->controller($this->mutableRequest('POST', [
            'ornament_type' => 'star', 'sender_name' => 'Mesmo nome', 'message' => 'Após exclusão',
        ], str_repeat('y', 16), ['christmas_tree_visitor' => $cookie]))->store($firstTree->tree->publicId);
        self::assertSame(409, $afterDeletion->status());
    }

    public function testDifferentVisitorsMayUseTheSameDisplayName(): void
    {
        $tree = $this->trees->create('Clara')->tree;
        foreach (['1', '2'] as $suffix) {
            $response = $this->controller($this->mutableRequest('POST', [
                'ornament_type' => 'heart', 'sender_name' => 'Nome igual', 'message' => 'Mensagem ' . $suffix,
            ], str_repeat($suffix, 16)))->store($tree->publicId);
            self::assertSame(201, $response->status());
        }
    }

    private function mutableRequest(string $method, array $body = [], string $idempotencyKey = '', array $cookies = []): Request
    {
        $server = [
            'REQUEST_METHOD' => $method,
            'CONTENT_LENGTH' => 128,
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_X_CSRF_TOKEN' => $this->csrf->token(),
        ];
        if ($idempotencyKey !== '') {
            $server['HTTP_IDEMPOTENCY_KEY'] = $idempotencyKey;
        }

        return new Request(parsedBody: $body, server: $server, cookies: $cookies);
    }

    private function controller(Request $request, int $rateLimit = 50, ?ChristmasTreeOrnamentService $ornaments = null): TreeOrnamentApiController
    {
        return new TreeOrnamentApiController(
            $request,
            $this->csrf,
            $this->trees,
            $ornaments ?? $this->ornaments,
            $this->ownerSession,
            $this->visitorIdentity,
            new RateLimiter($this->rateLimitDirectory, $rateLimit, 900),
        );
    }

    private function visitorCookie(\App\Core\Response $response): string
    {
        $header = $response->headers()['Set-Cookie'] ?? '';
        self::assertMatchesRegularExpression('/christmas_tree_visitor=([^;]+)/', $header);
        preg_match('/christmas_tree_visitor=([^;]+)/', $header, $matches);
        return rawurldecode($matches[1]);
    }

    private function messageServiceAt(string $instant, bool $manualRelease = false): ChristmasTreeOrnamentService
    {
        return new ChristmasTreeOrnamentService(
            $this->treeRepository,
            $this->ornamentRepository,
            60,
            '2026-12-25 00:00:00',
            'America/Sao_Paulo',
            static fn (): DateTimeImmutable => new DateTimeImmutable($instant),
            new MessageReleasePolicy(
                '2026-12-25 00:00:00',
                'America/Sao_Paulo',
                $manualRelease,
                static fn (): DateTimeImmutable => new DateTimeImmutable($instant),
            ),
        );
    }
}

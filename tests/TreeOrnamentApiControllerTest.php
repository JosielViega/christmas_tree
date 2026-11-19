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
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeOrnamentRepository;
use Tests\Support\InMemoryChristmasTreeRepository;

final class TreeOrnamentApiControllerTest extends TestCase
{
    private string $rateLimitDirectory;
    private Session $session;
    private Csrf $csrf;
    private ChristmasTreeIdentityService $trees;
    private ChristmasTreeOrnamentService $ornaments;
    private TreeOwnerSession $ownerSession;

    protected function setUp(): void
    {
        $_SESSION = [];
        $this->rateLimitDirectory = sys_get_temp_dir() . '/ornament-rate-limit-' . bin2hex(random_bytes(6));
        $treeRepository = new InMemoryChristmasTreeRepository();
        $this->session = new Session(false);
        $this->csrf = new Csrf($this->session);
        $this->trees = new ChristmasTreeIdentityService($treeRepository);
        $this->ornaments = new ChristmasTreeOrnamentService($treeRepository, new InMemoryChristmasTreeOrnamentRepository());
        $this->ownerSession = new TreeOwnerSession($this->session);
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
        $request = $this->mutableRequest('POST', ['ornament_type' => 'heart', 'sender_name' => 'João'], str_repeat('a', 16));
        $created = $this->controller($request)->store($tree->publicId);
        $payload = json_decode($created->body(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(201, $created->status());
        self::assertTrue($payload['data']['created']);
        self::assertSame('heart', $payload['data']['ornament']['ornament_type']);
        self::assertArrayNotHasKey('tree_id', $payload['data']['ornament']);

        $repeated = $this->controller($request)->store($tree->publicId);
        self::assertSame(200, $repeated->status());
        self::assertStringContainsString('"created":false', $repeated->body());

        $listed = $this->controller(new Request())->index($tree->publicId);
        self::assertSame(200, $listed->status());
        self::assertStringContainsString($payload['data']['ornament']['public_id'], $listed->body());
    }

    public function testRejectsInvalidCsrfTypeNameAndOversizedPayload(): void
    {
        $tree = $this->trees->create('Cecília')->tree;
        $invalidCsrf = new Request(parsedBody: [], server: [
            'REQUEST_METHOD' => 'POST', 'CONTENT_LENGTH' => 50, 'REMOTE_ADDR' => '127.0.0.1', 'HTTP_X_CSRF_TOKEN' => 'invalid',
        ]);
        self::assertSame(419, $this->controller($invalidCsrf)->store($tree->publicId)->status());

        $invalidData = $this->mutableRequest('POST', ['ornament_type' => 'invalid', 'sender_name' => 'x'], str_repeat('b', 16));
        self::assertSame(422, $this->controller($invalidData)->store($tree->publicId)->status());

        $oversized = new Request(parsedBody: [], server: [
            'REQUEST_METHOD' => 'POST', 'CONTENT_LENGTH' => 4097, 'REMOTE_ADDR' => '127.0.0.1', 'HTTP_X_CSRF_TOKEN' => $this->csrf->token(),
        ]);
        self::assertSame(413, $this->controller($oversized)->store($tree->publicId)->status());
    }

    public function testMissingTreeAndRateLimitReturnStandardErrors(): void
    {
        $request = $this->mutableRequest('POST', ['ornament_type' => 'star', 'sender_name' => 'Lia'], str_repeat('c', 16));
        self::assertSame(404, $this->controller($request)->store('AbCdEf1234_-')->status());

        $tree = $this->trees->create('Cecília')->tree;
        self::assertSame(201, $this->controller($request, 2)->store($tree->publicId)->status());
        $limited = $this->controller($this->mutableRequest('POST', ['ornament_type' => 'heart', 'sender_name' => 'Bia'], str_repeat('d', 16)), 2)
            ->store($tree->publicId);
        self::assertSame(429, $limited->status());
    }

    public function testOnlyOwnerCanDeleteAndDeletionIsScopedToTree(): void
    {
        $creation = $this->trees->create('Cecília');
        $otherCreation = $this->trees->create('Outra');
        $stored = $this->controller($this->mutableRequest('POST', ['ornament_type' => 'present', 'sender_name' => 'Leo'], str_repeat('e', 16)))
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

    private function mutableRequest(string $method, array $body = [], string $idempotencyKey = ''): Request
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

        return new Request(parsedBody: $body, server: $server);
    }

    private function controller(Request $request, int $rateLimit = 50): TreeOrnamentApiController
    {
        return new TreeOrnamentApiController(
            $request,
            $this->csrf,
            $this->trees,
            $this->ornaments,
            $this->ownerSession,
            new RateLimiter($this->rateLimitDirectory, $rateLimit, 900),
        );
    }
}

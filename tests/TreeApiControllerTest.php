<?php

declare(strict_types=1);

namespace Tests;

use App\Controllers\TreeApiController;
use App\Core\Csrf;
use App\Core\Request;
use App\Core\Session;
use App\Services\ChristmasTreeIdentityService;
use App\Services\RateLimiter;
use App\Services\TreeOwnerSession;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeRepository;
use Tests\Support\InMemoryPersistentTreeCredentialRepository;
use App\Services\PersistentTreeAccessService;

final class TreeApiControllerTest extends TestCase
{
    private string $rateLimitDirectory;
    private Session $session;
    private Csrf $csrf;
    private ChristmasTreeIdentityService $trees;
    private TreeOwnerSession $ownerSession;
    private InMemoryPersistentTreeCredentialRepository $persistentRepository;

    protected function setUp(): void
    {
        $_SESSION = [];
        $this->rateLimitDirectory = sys_get_temp_dir() . '/tree-rate-limit-' . bin2hex(random_bytes(6));
        $this->session = new Session(false);
        $this->csrf = new Csrf($this->session);
        $this->trees = new ChristmasTreeIdentityService(new InMemoryChristmasTreeRepository());
        $this->ownerSession = new TreeOwnerSession($this->session);
        $this->persistentRepository = new InMemoryPersistentTreeCredentialRepository();
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

    public function testCreateReturnsPublicDataAndRecoveryCodeButNoAdminToken(): void
    {
        $response = $this->controller($this->postRequest(['owner_name' => 'Marta']), 'https://admin:private@christmas.test?debug=1#token')->create();
        $payload = json_decode($response->body(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(201, $response->status());
        self::assertSame('Marta', $payload['data']['tree']['owner_name']);
        self::assertTrue($payload['data']['is_owner']);
        self::assertArrayHasKey('recovery_code', $payload['data']);
        self::assertArrayNotHasKey('admin_token', $payload['data']);
        self::assertStringStartsWith('/t/', $payload['data']['public_path']);
        self::assertSame('https://christmas.test' . $payload['data']['public_path'], $payload['data']['public_url']);
        self::assertStringNotContainsString('admin:private', $response->body());
        self::assertStringContainsString('tree_access=', $response->headers()['Set-Cookie'] ?? '');
        self::assertStringContainsString('HttpOnly', $response->headers()['Set-Cookie'] ?? '');
        self::assertStringContainsString('SameSite=Lax', $response->headers()['Set-Cookie'] ?? '');
        self::assertStringContainsString('Secure', $response->headers()['Set-Cookie'] ?? '');
    }

    public function testSecondTreeIsBlockedForRecognizedBrowser(): void
    {
        $first = $this->controller($this->postRequest(['owner_name' => 'Primeira']))->create();
        self::assertSame(201, $first->status());
        $second = $this->controller($this->postRequest(['owner_name' => 'Segunda']))->create();
        self::assertSame(409, $second->status());
        self::assertStringContainsString('tree_already_exists', $second->body());
    }

    public function testCreateRejectsInvalidCsrf(): void
    {
        $request = new Request(parsedBody: ['owner_name' => 'Marta'], server: [
            'REQUEST_METHOD' => 'POST',
            'CONTENT_LENGTH' => 20,
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_X_CSRF_TOKEN' => 'invalid',
        ]);
        $response = $this->controller($request)->create();

        self::assertSame(419, $response->status());
        self::assertStringContainsString('csrf_failed', $response->body());
    }

    public function testPublicAndAdministrativeContextsRemainSeparated(): void
    {
        $created = $this->controller($this->postRequest(['owner_name' => 'Bianca']))->create();
        $payload = json_decode($created->body(), true, 512, JSON_THROW_ON_ERROR);
        $publicId = $payload['data']['tree']['public_id'];

        $publicResponse = $this->controller(new Request())->show($publicId);
        self::assertSame(200, $publicResponse->status());
        self::assertStringNotContainsString('recovery', $publicResponse->body());

        $adminResponse = $this->controller(new Request())->admin($publicId);
        self::assertSame(200, $adminResponse->status());

        $_SESSION = [];
        $denied = $this->controller(new Request())->admin($publicId);
        self::assertSame(403, $denied->status());
    }

    public function testRecoveryRequiresValidCodeAndRotatesIt(): void
    {
        $created = $this->controller($this->postRequest(['owner_name' => 'Rafael']))->create();
        $payload = json_decode($created->body(), true, 512, JSON_THROW_ON_ERROR);
        $publicId = $payload['data']['tree']['public_id'];
        $recoveryCode = $payload['data']['recovery_code'];
        $_SESSION = [];

        $invalid = $this->controller($this->postRequest(['recovery_code' => str_repeat('z', 43)]))->recover($publicId);
        self::assertSame(401, $invalid->status());

        $recovered = $this->controller($this->postRequest(['recovery_code' => $recoveryCode]))->recover($publicId);
        $recoveredPayload = json_decode($recovered->body(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(200, $recovered->status());
        self::assertNotSame($recoveryCode, $recoveredPayload['data']['recovery_code']);
        self::assertArrayNotHasKey('admin_token', $recoveredPayload['data']);
    }

    public function testMissingTreeReturnsStandardizedNotFoundError(): void
    {
        $response = $this->controller(new Request())->show('AbCdEf1234_-');

        self::assertSame(404, $response->status());
        self::assertStringContainsString('tree_not_found', $response->body());
    }

    private function postRequest(array $body): Request
    {
        return new Request(parsedBody: $body, server: [
            'REQUEST_METHOD' => 'POST',
            'CONTENT_LENGTH' => 128,
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_X_CSRF_TOKEN' => $this->csrf->token(),
        ]);
    }

    private function controller(Request $request, string $appUrl = 'https://christmas.test'): TreeApiController
    {
        $persistent = new PersistentTreeAccessService($this->persistentRepository, $this->ownerSession, 'tree_access', 90, true);
        return new TreeApiController(
            $request,
            $this->csrf,
            $this->trees,
            $this->ownerSession,
            new RateLimiter($this->rateLimitDirectory . '/create', 20, 900),
            new RateLimiter($this->rateLimitDirectory . '/recover', 20, 900),
            ['url' => $appUrl],
            $persistent,
        );
    }
}

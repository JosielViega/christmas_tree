<?php

declare(strict_types=1);

namespace Tests;

use App\Controllers\TreeMemoryApiController;
use App\Core\Csrf;
use App\Core\Request;
use App\Core\Session;
use App\Services\ChristmasTreeIdentityService;
use App\Services\ChristmasTreeMemoryService;
use App\Services\MemoryImageStorage;
use App\Services\RateLimiter;
use App\Services\TreeOwnerSession;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeMemoryRepository;
use Tests\Support\InMemoryChristmasTreeRepository;

final class TreeMemoryApiControllerTest extends TestCase
{
    private string $root;
    private Session $session;
    private Csrf $csrf;
    private ChristmasTreeIdentityService $trees;
    private TreeOwnerSession $owner;
    private ChristmasTreeMemoryService $service;

    protected function setUp(): void
    {
        $_SESSION = []; $this->root = sys_get_temp_dir() . '/memory-api-' . bin2hex(random_bytes(5));
        $this->session = new Session(false); $this->csrf = new Csrf($this->session);
        $this->trees = new ChristmasTreeIdentityService(new InMemoryChristmasTreeRepository());
        $this->owner = new TreeOwnerSession($this->session);
        $this->service = new ChristmasTreeMemoryService($this->trees, new InMemoryChristmasTreeMemoryRepository(), new MemoryImageStorage($this->root . '/images'));
    }

    protected function tearDown(): void { $this->remove($this->root); }

    public function testOwnerUploadsPubliclyListsServesUpdatesAndDeletesMemory(): void
    {
        $creation = $this->trees->create('Proprietária'); $upload = $this->upload();
        self::assertSame(403, $this->controller($this->request('POST', ['caption' => 'Viagem'], ['image' => $upload]))->store($creation->tree->publicId)->status());
        $this->owner->grant($creation->tree->publicId, $creation->adminToken);
        $created = $this->controller($this->request('POST', ['caption' => 'Viagem ❤️'], ['image' => $upload]))->store($creation->tree->publicId);
        unlink($upload['tmp_name']);
        self::assertSame(201, $created->status());
        $payload = json_decode($created->body(), true, 512, JSON_THROW_ON_ERROR); $id = $payload['data']['memory']['public_id'];
        self::assertStringNotContainsString('image_path', $created->body());
        self::assertStringNotContainsString('message', strtolower($created->body()));
        $listed = $this->controller(new Request())->index($creation->tree->publicId);
        self::assertSame(200, $listed->status()); self::assertStringContainsString('Viagem', $listed->body());
        $image = $this->controller(new Request())->image($creation->tree->publicId, $id);
        self::assertSame(200, $image->status()); self::assertSame('image/jpeg', $image->headers()['Content-Type']);
        $updated = $this->controller($this->request('POST', ['caption' => 'Nova legenda']))->update($creation->tree->publicId, $id);
        self::assertSame(200, $updated->status()); self::assertStringContainsString('Nova legenda', $updated->body());
        self::assertSame(200, $this->controller($this->request('DELETE'))->destroy($creation->tree->publicId, $id)->status());
        self::assertSame(404, $this->controller(new Request())->image($creation->tree->publicId, $id)->status());
    }

    public function testCsrfPayloadAndDifferentTreeAuthorizationAreEnforced(): void
    {
        $first = $this->trees->create('Primeira'); $second = $this->trees->create('Segunda');
        $invalid = new Request(server: ['REQUEST_METHOD' => 'POST', 'CONTENT_LENGTH' => 10, 'HTTP_X_CSRF_TOKEN' => 'bad', 'REMOTE_ADDR' => '127.0.0.1']);
        self::assertSame(419, $this->controller($invalid)->store($first->tree->publicId)->status());
        $oversized = new Request(server: ['REQUEST_METHOD' => 'POST', 'CONTENT_LENGTH' => 9000000, 'HTTP_X_CSRF_TOKEN' => $this->csrf->token(), 'REMOTE_ADDR' => '127.0.0.1']);
        self::assertSame(413, $this->controller($oversized)->store($first->tree->publicId)->status());
        $this->owner->grant($second->tree->publicId, $second->adminToken);
        self::assertSame(403, $this->controller($this->request('POST'))->store($first->tree->publicId)->status());
    }

    private function controller(Request $request): TreeMemoryApiController
    {
        return new TreeMemoryApiController($request, $this->csrf, $this->trees, $this->service, $this->owner, new RateLimiter($this->root . '/rate', 100, 900), 8650752);
    }

    private function request(string $method, array $body = [], array $files = []): Request
    {
        return new Request(parsedBody: $body, server: ['REQUEST_METHOD' => $method, 'CONTENT_LENGTH' => 1024, 'HTTP_X_CSRF_TOKEN' => $this->csrf->token(), 'REMOTE_ADDR' => '127.0.0.1'], files: $files);
    }

    private function upload(): array
    {
        $path = tempnam(sys_get_temp_dir(), 'memory-api-png-'); $image = imagecreatetruecolor(120, 120); imagepng($image, $path);
        return ['tmp_name' => $path, 'size' => filesize($path), 'error' => UPLOAD_ERR_OK, 'name' => 'memory.png', 'type' => 'image/png'];
    }

    private function remove(string $directory): void
    {
        if (!is_dir($directory)) return;
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $item) $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname()); rmdir($directory);
    }
}

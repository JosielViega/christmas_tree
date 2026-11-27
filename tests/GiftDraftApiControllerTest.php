<?php

declare(strict_types=1);

namespace Tests;

use App\Controllers\GiftDraftApiController;
use App\Core\Csrf;
use App\Core\Request;
use App\Core\Session;
use App\Services\ChristmasTreeGiftService;
use App\Services\ChristmasTreeIdentityService;
use App\Services\GiftDraftAccessSession;
use App\Services\GiftTextureStorage;
use App\Services\RateLimiter;
use App\Services\TreeOwnerSession;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeGiftRepository;
use Tests\Support\InMemoryChristmasTreeRepository;

final class GiftDraftApiControllerTest extends TestCase
{
    private string $temporaryRoot;
    private Session $session;
    private Csrf $csrf;
    private ChristmasTreeIdentityService $trees;
    private ChristmasTreeGiftService $gifts;
    private GiftDraftAccessSession $access;
    private TreeOwnerSession $owner;

    protected function setUp(): void
    {
        $_SESSION = [];
        $this->temporaryRoot = sys_get_temp_dir() . '/gift-api-' . bin2hex(random_bytes(5));
        $treeRepository = new InMemoryChristmasTreeRepository();
        $this->trees = new ChristmasTreeIdentityService($treeRepository);
        $this->session = new Session(false);
        $this->csrf = new Csrf($this->session);
        $this->access = new GiftDraftAccessSession($this->session);
        $this->owner = new TreeOwnerSession($this->session);
        $this->gifts = new ChristmasTreeGiftService(
            $treeRepository,
            new InMemoryChristmasTreeGiftRepository(),
            new GiftTextureStorage($this->temporaryRoot . '/private'),
        );
    }

    protected function tearDown(): void
    {
        $this->removeDirectory($this->temporaryRoot);
    }

    public function testCreatesQueriesAndCancelsDraftWithoutLeakingPrivateContent(): void
    {
        $tree = $this->trees->create('Lia')->tree;
        $upload = $this->upload();
        $created = $this->controller($this->createRequest($upload))->store($tree->publicId);
        $payload = json_decode($created->body(), true, 512, JSON_THROW_ON_ERROR);
        $giftId = $payload['data']['gift']['public_id'];
        $token = $payload['data']['access_token'];

        self::assertSame(201, $created->status());
        self::assertSame('draft', $payload['data']['gift']['status']);
        self::assertArrayNotHasKey('message', $payload['data']['gift']);
        self::assertStringNotContainsString('Mensagem reservada', $created->body());
        self::assertStringNotContainsString('texture_path', $created->body());
        self::assertSame('private, no-store, max-age=0', $created->headers()['Cache-Control']);

        $unauthorized = $this->controller(new Request(server: ['HTTP_X_GIFT_DRAFT_TOKEN' => str_repeat('x', 43)]))->show($giftId);
        self::assertSame(404, $unauthorized->status());
        $authorized = $this->controller(new Request(server: ['HTTP_X_GIFT_DRAFT_TOKEN' => $token]))->show($giftId);
        self::assertSame(200, $authorized->status());

        $deleted = $this->controller(new Request(server: [
            'REQUEST_METHOD' => 'DELETE', 'CONTENT_LENGTH' => 0, 'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_X_CSRF_TOKEN' => $this->csrf->token(), 'HTTP_X_GIFT_DRAFT_TOKEN' => $token,
        ]))->destroy($giftId);
        self::assertSame(200, $deleted->status());
        self::assertStringContainsString('cancelled', $deleted->body());
        unlink($upload['tmp_name']);
    }

    public function testEnforcesCsrfPayloadLimitRateLimitAndDoesNotExposePaidRoutes(): void
    {
        $tree = $this->trees->create('Lia')->tree;
        $upload = $this->upload();
        $invalidCsrf = $this->createRequest($upload, 'invalid');
        self::assertSame(419, $this->controller($invalidCsrf)->store($tree->publicId)->status());

        $oversized = new Request(server: [
            'REQUEST_METHOD' => 'POST', 'CONTENT_LENGTH' => 3000000, 'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_X_CSRF_TOKEN' => $this->csrf->token(),
        ]);
        self::assertSame(413, $this->controller($oversized)->store($tree->publicId)->status());

        self::assertSame(201, $this->controller($this->createRequest($upload), 1)->store($tree->publicId)->status());
        $limitedUpload = $this->upload();
        self::assertSame(429, $this->controller($this->createRequest($limitedUpload, null, str_repeat('z', 16)), 1)->store($tree->publicId)->status());

        $routes = (string) file_get_contents(dirname(__DIR__) . '/routes/web.php');
        self::assertStringNotContainsString('/paid', $routes);
        self::assertStringNotContainsString('/publish', $routes);
        unlink($upload['tmp_name']);
        unlink($limitedUpload['tmp_name']);
    }

    public function testOwnerCannotCreateOrUploadGiftForOwnTreeButCanGiftAnotherTree(): void
    {
        $ownerTree = $this->trees->create('Lia');
        $friendTree = $this->trees->create('Bia');
        $this->owner->grant($ownerTree->tree->publicId, $ownerTree->adminToken);

        $blockedUpload = $this->upload();
        $blocked = $this->controller($this->createRequest($blockedUpload))->store($ownerTree->tree->publicId);
        self::assertSame(403, $blocked->status());
        self::assertStringContainsString('owner_cannot_gift', $blocked->body());
        self::assertDirectoryDoesNotExist($this->temporaryRoot . '/private');

        $friendUpload = $this->upload();
        $allowed = $this->controller($this->createRequest($friendUpload, null, str_repeat('f', 16)))->store($friendTree->tree->publicId);
        self::assertSame(201, $allowed->status());

        unlink($blockedUpload['tmp_name']);
        unlink($friendUpload['tmp_name']);
    }

    private function controller(Request $request, int $limit = 20): GiftDraftApiController
    {
        return new GiftDraftApiController(
            $request,
            $this->csrf,
            $this->gifts,
            $this->trees,
            $this->owner,
            $this->access,
            new RateLimiter($this->temporaryRoot . '/rates', $limit, 900),
            2359296,
        );
    }

    private function createRequest(array $upload, ?string $csrf = null, string $key = 'abcdefghijklmnop'): Request
    {
        return new Request(
            parsedBody: [
                'sender_name' => 'Ana', 'gift_style' => 'classic', 'composition_mode' => 'repeated',
                'message' => 'Mensagem reservada', 'publication_consent' => 'accepted',
            ],
            server: [
                'REQUEST_METHOD' => 'POST', 'CONTENT_LENGTH' => $upload['size'] + 1000, 'REMOTE_ADDR' => '127.0.0.1',
                'HTTP_X_CSRF_TOKEN' => $csrf ?? $this->csrf->token(), 'HTTP_IDEMPOTENCY_KEY' => $key,
            ],
            files: ['texture' => $upload],
        );
    }

    private function upload(): array
    {
        $path = tempnam(sys_get_temp_dir(), 'gift-api-png-');
        $image = imagecreatetruecolor(64, 64);
        imagepng($image, $path);
        return ['tmp_name' => $path, 'size' => filesize($path), 'error' => UPLOAD_ERR_OK, 'name' => 'texture.png', 'type' => 'image/png'];
    }

    private function removeDirectory(string $directory): void
    {
        if (!is_dir($directory)) return;
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $item) $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        rmdir($directory);
    }
}

<?php

declare(strict_types=1);

namespace Tests;

use App\Domain\GiftDraftValidationException;
use App\Domain\IdempotencyConflict;
use App\Services\ChristmasTreeGiftService;
use App\Services\ChristmasTreeIdentityService;
use App\Services\GiftTextureStorage;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeGiftRepository;
use Tests\Support\InMemoryChristmasTreeRepository;

final class ChristmasTreeGiftServiceTest extends TestCase
{
    private string $storage;
    private InMemoryChristmasTreeGiftRepository $gifts;
    private ChristmasTreeIdentityService $trees;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->storage = sys_get_temp_dir() . '/gift-service-' . bin2hex(random_bytes(5));
        $trees = new InMemoryChristmasTreeRepository();
        $this->trees = new ChristmasTreeIdentityService($trees);
        $this->gifts = new InMemoryChristmasTreeGiftRepository();
        $this->now = new DateTimeImmutable('2026-11-20T12:00:00Z');
        $this->treeRepository = $trees;
    }

    private InMemoryChristmasTreeRepository $treeRepository;

    protected function tearDown(): void
    {
        if (!is_dir($this->storage)) return;
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->storage, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $item) $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        rmdir($this->storage);
    }

    public function testCreatesPrivateDraftDeduplicatesAndRejectsConflictingPayload(): void
    {
        $tree = $this->trees->create('Árvore')->tree;
        $service = $this->service();
        $upload = $this->upload();
        $first = $service->create($tree->publicId, ' Ana  Silva ', 'classic', 'repeated', 'Feliz Natal!', str_repeat('a', 16), true, $upload);
        $repeat = $service->create($tree->publicId, 'Ana Silva', 'classic', 'repeated', 'Feliz Natal!', str_repeat('a', 16), true, $upload);

        self::assertTrue($first->created);
        self::assertNotEmpty($first->accessToken);
        self::assertFalse($repeat->created);
        self::assertNull($repeat->accessToken);
        self::assertSame($first->gift->publicId, $repeat->gift->publicId);
        self::assertCount(1, $this->gifts->records);
        self::assertSame('draft', $first->gift->status);
        self::assertFalse($first->gift->status === 'paid' || $first->gift->status === 'published');

        $this->expectException(IdempotencyConflict::class);
        try {
            $service->create($tree->publicId, 'Ana Silva', 'classic', 'repeated', 'Mensagem alterada', str_repeat('a', 16), true, $upload);
        } finally {
            unlink($upload['tmp_name']);
        }
    }

    public function testRequiresTreeAllowedMetadataMessageConsentAndValidTexture(): void
    {
        $tree = $this->trees->create('Árvore')->tree;
        $upload = $this->upload();
        try {
            $this->service()->create($tree->publicId, 'x', 'invalid', 'wrong', '', 'short', false, $upload);
            self::fail('Validation should fail.');
        } catch (GiftDraftValidationException $exception) {
            foreach (['sender_name', 'gift_style', 'composition_mode', 'message', 'idempotency_key', 'publication_consent'] as $field) {
                self::assertArrayHasKey($field, $exception->errors);
            }
        }
        self::assertNull($this->service()->create('AbCdEf1234_-', 'Ana', 'classic', 'repeated', 'Mensagem', str_repeat('b', 16), true, $upload));
        unlink($upload['tmp_name']);
    }

    public function testAccessCancellationExpirationAndCleanupAreAuthorizedAndIdempotent(): void
    {
        $tree = $this->trees->create('Árvore')->tree;
        $upload = $this->upload();
        $service = $this->service(1);
        $creation = $service->create($tree->publicId, 'Ana', 'magic', 'featured', 'Mensagem privada', str_repeat('c', 16), true, $upload);
        self::assertNull($service->findAuthorized($creation->gift->publicId, str_repeat('x', 43)));
        self::assertSame('draft', $service->findAuthorized($creation->gift->publicId, $creation->accessToken)->status);
        self::assertSame('cancelled', $service->cancel($creation->gift->publicId, $creation->accessToken)->status);
        self::assertSame('cancelled', $service->cancel($creation->gift->publicId, $creation->accessToken)->status);
        self::assertSame('', $this->gifts->records[$creation->gift->publicId]->texturePath);

        $secondUpload = $this->upload();
        $second = $service->create($tree->publicId, 'Bia', 'romantic', 'repeated', 'Outra mensagem', str_repeat('d', 16), true, $secondUpload);
        $this->now = $this->now->modify('+2 hours');
        self::assertSame('expired', $service->findAuthorized($second->gift->publicId, $second->accessToken)->status);
        self::assertSame(0, $service->cleanupExpired());
        unlink($upload['tmp_name']);
        unlink($secondUpload['tmp_name']);
    }

    public function testAnonymousVisitorLimitDoesNotRestrictMultiplePremiumDrafts(): void
    {
        $tree = $this->trees->create('Árvore')->tree;
        $service = $this->service();
        $firstUpload = $this->upload();
        $secondUpload = $this->upload();
        $first = $service->create($tree->publicId, 'Mesmo visitante', 'classic', 'repeated', 'Primeiro presente', str_repeat('u', 16), true, $firstUpload);
        $second = $service->create($tree->publicId, 'Mesmo visitante', 'magic', 'featured', 'Segundo presente', str_repeat('v', 16), true, $secondUpload);

        self::assertTrue($first->created);
        self::assertTrue($second->created);
        self::assertNotSame($first->gift->publicId, $second->gift->publicId);
        self::assertCount(2, $this->gifts->records);
        unlink($firstUpload['tmp_name']);
        unlink($secondUpload['tmp_name']);
    }

    private function service(int $hours = 24): ChristmasTreeGiftService
    {
        return new ChristmasTreeGiftService(
            $this->treeRepository,
            $this->gifts,
            new GiftTextureStorage($this->storage),
            $hours,
            fn (): DateTimeImmutable => $this->now,
        );
    }

    private function upload(): array
    {
        $path = tempnam(sys_get_temp_dir(), 'gift-service-png-');
        $image = imagecreatetruecolor(64, 64);
        imagefill($image, 0, 0, imagecolorallocate($image, 15, 90, 40));
        imagepng($image, $path);
        return ['tmp_name' => $path, 'size' => filesize($path), 'error' => UPLOAD_ERR_OK, 'name' => 'texture.png', 'type' => 'image/png'];
    }
}

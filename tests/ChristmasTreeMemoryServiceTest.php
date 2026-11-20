<?php

declare(strict_types=1);

namespace Tests;

use App\Domain\MemoryCapacityReached;
use App\Domain\MemoryValidationException;
use App\Services\ChristmasTreeIdentityService;
use App\Services\ChristmasTreeMemoryService;
use App\Services\MemoryImageStorage;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeMemoryRepository;
use Tests\Support\InMemoryChristmasTreeRepository;

final class ChristmasTreeMemoryServiceTest extends TestCase
{
    private string $root;
    private ChristmasTreeIdentityService $trees;
    private InMemoryChristmasTreeMemoryRepository $repository;
    private ChristmasTreeMemoryService $service;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/memory-service-' . bin2hex(random_bytes(5));
        $this->trees = new ChristmasTreeIdentityService(new InMemoryChristmasTreeRepository());
        $this->repository = new InMemoryChristmasTreeMemoryRepository();
        $this->service = new ChristmasTreeMemoryService($this->trees, $this->repository, new MemoryImageStorage($this->root));
    }

    protected function tearDown(): void { $this->remove($this->root); }

    public function testPersistsSixStableMemoriesAndRejectsSeventhWithoutOrphan(): void
    {
        $tree = $this->trees->create('Memórias')->tree;
        $created = [];
        for ($index = 0; $index < 6; $index++) {
            $upload = $this->upload();
            $created[] = $this->service->create($tree->publicId, $index === 0 ? 'Nossa viagem ❤️' : '', $upload);
            unlink($upload['tmp_name']);
        }
        self::assertSame([0, 1, 2, 3, 4, 5], array_map(static fn ($memory) => $memory->slotIndex, $created));
        self::assertSame('Nossa viagem ❤️', $created[0]?->caption);
        self::assertCount(6, $this->service->list($tree->publicId) ?? []);
        $filesBefore = $this->files();
        $seventh = $this->upload();
        try { $this->service->create($tree->publicId, '', $seventh); self::fail('Seventh memory accepted.'); }
        catch (MemoryCapacityReached) { self::addToAssertionCount(1); }
        unlink($seventh['tmp_name']);
        self::assertSame($filesBefore, $this->files());

        $removed = $created[2];
        self::assertTrue($this->service->delete($tree->publicId, (string) $removed?->publicId));
        $replacement = $this->upload();
        $new = $this->service->create($tree->publicId, 'Nova', $replacement); unlink($replacement['tmp_name']);
        self::assertSame(2, $new?->slotIndex);
        self::assertSame(0, $created[0]?->slotIndex);
    }

    public function testReplacementDeletesOldFileAndTreeSeparationIsEnforced(): void
    {
        $first = $this->trees->create('Primeira')->tree;
        $second = $this->trees->create('Segunda')->tree;
        $upload = $this->upload(); $memory = $this->service->create($first->publicId, 'Original', $upload); unlink($upload['tmp_name']);
        $oldPath = $memory?->imagePath;
        $replacement = $this->upload(180, 120);
        $updated = $this->service->update($first->publicId, (string) $memory?->publicId, 'Atualizada ✨', $replacement); unlink($replacement['tmp_name']);
        self::assertNotSame($oldPath, $updated?->imagePath);
        self::assertSame('Atualizada ✨', $updated?->caption);
        self::assertFalse(is_file($this->root . '/' . $oldPath));
        self::assertNull($this->service->update($second->publicId, (string) $memory?->publicId, 'Ataque', null));
        self::assertFalse($this->service->delete($second->publicId, (string) $memory?->publicId));
        self::assertNotNull($this->service->image($first->publicId, (string) $memory?->publicId));
    }

    public function testRejectsOverlongCaptionBeforeWritingFile(): void
    {
        $tree = $this->trees->create('Legenda')->tree; $upload = $this->upload();
        try { $this->service->create($tree->publicId, str_repeat('ç', 81), $upload); self::fail('Caption accepted.'); }
        catch (MemoryValidationException $exception) { self::assertArrayHasKey('caption', $exception->errors); }
        unlink($upload['tmp_name']);
        self::assertSame([], $this->files());
    }

    private function upload(int $width = 120, int $height = 120): array
    {
        $path = tempnam(sys_get_temp_dir(), 'memory-service-png-'); $image = imagecreatetruecolor($width, $height);
        imagefill($image, 0, 0, imagecolorallocate($image, 80, 30, 100)); imagepng($image, $path);
        return ['tmp_name' => $path, 'size' => filesize($path), 'error' => UPLOAD_ERR_OK, 'name' => 'memory.png', 'type' => 'image/png'];
    }

    private function files(): array
    {
        if (!is_dir($this->root)) return [];
        $files = []; foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->root, \FilesystemIterator::SKIP_DOTS)) as $item) if ($item->isFile()) $files[] = $item->getPathname();
        sort($files); return $files;
    }

    private function remove(string $directory): void
    {
        if (!is_dir($directory)) return;
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $item) $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname()); rmdir($directory);
    }
}

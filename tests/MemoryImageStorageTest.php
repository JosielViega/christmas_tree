<?php

declare(strict_types=1);

namespace Tests;

use App\Domain\MemoryValidationException;
use App\Services\MemoryImageStorage;
use PHPUnit\Framework\TestCase;

final class MemoryImageStorageTest extends TestCase
{
    private string $root;

    protected function setUp(): void { $this->root = sys_get_temp_dir() . '/memory-images-' . bin2hex(random_bytes(5)); }
    protected function tearDown(): void { $this->remove($this->root); }

    public function testReprocessesImageAsBoundedJpegWithoutSourceMetadata(): void
    {
        $upload = $this->imageUpload(1400, 900, 'png');
        file_put_contents($upload['tmp_name'], 'EXIF-PRIVATE-MARKER', FILE_APPEND);
        $storage = new MemoryImageStorage($this->root);
        $stored = $storage->store($upload);
        $inspected = $storage->inspect($stored->logicalPath);
        self::assertMatchesRegularExpression('#^\d{4}/\d{2}/[a-f0-9]{40}\.jpg$#', $stored->logicalPath);
        self::assertSame('image/jpeg', (new \finfo(FILEINFO_MIME_TYPE))->file($inspected['path']));
        self::assertSame([900, 900], array_slice((array) getimagesize($inspected['path']), 0, 2));
        self::assertStringNotContainsString('EXIF-PRIVATE-MARKER', (string) file_get_contents($inspected['path']));
        self::assertTrue($storage->delete($stored->logicalPath));
        unlink($upload['tmp_name']);
    }

    public function testRejectsInvalidSignatureOversizeAndInvalidDimensions(): void
    {
        $invalid = tempnam(sys_get_temp_dir(), 'memory-invalid-'); file_put_contents($invalid, '<svg/>');
        $small = $this->imageUpload(32, 32, 'png');
        foreach ([
            [new MemoryImageStorage($this->root), ['tmp_name' => $invalid, 'size' => filesize($invalid), 'error' => UPLOAD_ERR_OK]],
            [new MemoryImageStorage($this->root), $small],
            [new MemoryImageStorage($this->root, 10), $this->imageUpload(100, 100, 'jpeg')],
        ] as [$storage, $upload]) {
            try { $storage->store($upload); self::fail('Invalid image accepted.'); }
            catch (MemoryValidationException $exception) { self::assertArrayHasKey('image', $exception->errors); }
            if (is_file($upload['tmp_name'])) unlink($upload['tmp_name']);
        }
    }

    private function imageUpload(int $width, int $height, string $type): array
    {
        $path = tempnam(sys_get_temp_dir(), 'memory-source-');
        $image = imagecreatetruecolor($width, $height); imagefill($image, 0, 0, imagecolorallocate($image, 40, 100, 70));
        $type === 'png' ? imagepng($image, $path) : imagejpeg($image, $path, 90);
        return ['tmp_name' => $path, 'size' => filesize($path), 'error' => UPLOAD_ERR_OK, 'name' => 'photo.' . $type, 'type' => 'image/' . $type];
    }

    private function remove(string $directory): void
    {
        if (!is_dir($directory)) return;
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $item) $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        rmdir($directory);
    }
}

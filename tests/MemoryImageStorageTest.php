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
        self::assertSame([1024, 1024], array_slice((array) getimagesize($inspected['path']), 0, 2));
        self::assertStringNotContainsString('EXIF-PRIVATE-MARKER', (string) file_get_contents($inspected['path']));
        self::assertTrue($storage->delete($stored->logicalPath));
        unlink($upload['tmp_name']);
    }

    public function testAcceptsRealJpegPngWebpLandscapeAndPortraitImages(): void
    {
        $storage = new MemoryImageStorage($this->root);
        $formats = ['jpeg', 'png'];
        if (function_exists('imagewebp')) $formats[] = 'webp';

        foreach ($formats as $format) {
            foreach ([[320, 180], [180, 320]] as [$width, $height]) {
                $upload = $this->imageUpload($width, $height, $format);
                $stored = $storage->store($upload);
                $inspected = $storage->inspect($stored->logicalPath);
                self::assertSame([320, 320], array_slice((array) getimagesize($inspected['path']), 0, 2));
                self::assertTrue($storage->delete($stored->logicalPath));
                unlink($upload['tmp_name']);
            }
        }
    }

    public function testContainNormalizationPreservesLandscapeEdgesAndAddsNeutralPadding(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'memory-edges-');
        $source = imagecreatetruecolor(160, 90);
        imagefill($source, 0, 0, imagecolorallocate($source, 35, 120, 65));
        imagefilledrectangle($source, 0, 0, 15, 89, imagecolorallocate($source, 220, 35, 35));
        imagefilledrectangle($source, 144, 0, 159, 89, imagecolorallocate($source, 35, 55, 220));
        imagepng($source, $path);
        $upload = ['tmp_name' => $path, 'size' => filesize($path), 'error' => UPLOAD_ERR_OK, 'name' => 'edges.png', 'type' => 'image/png'];

        $storage = new MemoryImageStorage($this->root);
        $stored = $storage->store($upload);
        $inspected = $storage->inspect($stored->logicalPath);
        $normalized = imagecreatefromjpeg($inspected['path']);
        self::assertNotFalse($normalized);
        self::assertSame([160, 160], array_slice((array) getimagesize($inspected['path']), 0, 2));

        $left = imagecolorsforindex($normalized, imagecolorat($normalized, 5, 80));
        $right = imagecolorsforindex($normalized, imagecolorat($normalized, 154, 80));
        $padding = imagecolorsforindex($normalized, imagecolorat($normalized, 80, 5));
        self::assertGreaterThan($left['blue'] + 100, $left['red']);
        self::assertGreaterThan($right['red'] + 100, $right['blue']);
        self::assertGreaterThan(220, $padding['red']);
        self::assertGreaterThan(220, $padding['green']);
        self::assertGreaterThan(210, $padding['blue']);

        self::assertTrue($storage->delete($stored->logicalPath));
        unlink($path);
    }

    public function testAcceptsOrientedJpegAndRemovesExifMetadata(): void
    {
        $upload = $this->imageUpload(320, 180, 'jpeg');
        $jpeg = (string) file_get_contents($upload['tmp_name']);
        $exif = "Exif\0\0MM\0\x2A\0\0\0\x08\0\x01\x01\x12\0\x03\0\0\0\x01\0\x06\0\0\0\0\0\0";
        $withOrientation = substr($jpeg, 0, 2) . "\xFF\xE1" . pack('n', strlen($exif) + 2) . $exif . substr($jpeg, 2);
        file_put_contents($upload['tmp_name'], $withOrientation);
        $upload['size'] = filesize($upload['tmp_name']);

        $storage = new MemoryImageStorage($this->root);
        $stored = $storage->store($upload);
        $inspected = $storage->inspect($stored->logicalPath);
        self::assertStringNotContainsString('Exif', (string) file_get_contents($inspected['path']));
        self::assertSame([320, 320], array_slice((array) getimagesize($inspected['path']), 0, 2));
        self::assertTrue($storage->delete($stored->logicalPath));
        unlink($upload['tmp_name']);
    }

    public function testRejectsInvalidSignatureOversizeAndInvalidDimensions(): void
    {
        $invalid = tempnam(sys_get_temp_dir(), 'memory-invalid-'); file_put_contents($invalid, '<svg/>');
        $empty = tempnam(sys_get_temp_dir(), 'memory-empty-');
        $small = $this->imageUpload(32, 32, 'png');
        foreach ([
            [new MemoryImageStorage($this->root), ['tmp_name' => $invalid, 'size' => filesize($invalid), 'error' => UPLOAD_ERR_OK]],
            [new MemoryImageStorage($this->root), ['tmp_name' => $empty, 'size' => 0, 'error' => UPLOAD_ERR_OK]],
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
        match ($type) {
            'png' => imagepng($image, $path),
            'webp' => imagewebp($image, $path, 90),
            default => imagejpeg($image, $path, 90),
        };
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

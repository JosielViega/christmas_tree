<?php

declare(strict_types=1);

namespace Tests;

use App\Domain\GiftDraftValidationException;
use App\Services\GiftTextureStorage;
use PHPUnit\Framework\TestCase;

final class GiftTextureStorageTest extends TestCase
{
    private string $root;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/gift-private-' . bin2hex(random_bytes(5));
    }

    protected function tearDown(): void
    {
        $this->removeDirectory($this->root);
    }

    public function testReprocessesPngIntoRandomPrivatePathWithoutMetadata(): void
    {
        $upload = $this->pngUpload(512, 512);
        $stored = (new GiftTextureStorage($this->root))->store($upload);
        $path = $this->root . '/' . $stored->logicalPath;

        self::assertMatchesRegularExpression('#^\d{4}/\d{2}/[a-f0-9]{40}\.png$#', $stored->logicalPath);
        self::assertFileExists($path);
        self::assertSame('image/png', (new \finfo(FILEINFO_MIME_TYPE))->file($path));
        self::assertSame([512, 512], array_slice((array) getimagesize($path), 0, 2));
        $inspected = (new GiftTextureStorage($this->root))->inspect($stored->logicalPath);
        self::assertSame($stored->contentHash, $inspected['sha256']);
        self::assertSame(filesize($path), $inspected['size']);
        self::assertTrue((new GiftTextureStorage($this->root))->delete($stored->logicalPath));
        self::assertFileDoesNotExist($path);
        unlink($upload['tmp_name']);
    }

    public function testInspectRejectsTraversalAndMissingFiles(): void
    {
        $storage = new GiftTextureStorage($this->root);
        foreach (['../secret.png', '2026/11/' . str_repeat('a', 40) . '.png'] as $path) {
            try {
                $storage->inspect($path);
                self::fail('Private storage path should be rejected.');
            } catch (\RuntimeException) {
                self::addToAssertionCount(1);
            }
        }
    }

    public function testRejectsSvgInvalidSignatureOversizeAndDimensions(): void
    {
        $svg = tempnam(sys_get_temp_dir(), 'gift-svg-');
        file_put_contents($svg, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
        $cases = [
            [['tmp_name' => $svg, 'size' => filesize($svg), 'error' => UPLOAD_ERR_OK]],
            [$this->pngUpload(513, 20)],
            [$this->pngUpload(20, 20), 10],
        ];
        foreach ($cases as $case) {
            [$upload, $max] = [$case[0], $case[1] ?? 2097152];
            try {
                (new GiftTextureStorage($this->root, $max))->store($upload);
                self::fail('Invalid texture should be rejected.');
            } catch (GiftDraftValidationException $exception) {
                self::assertArrayHasKey('texture', $exception->errors);
            }
            if (is_file($upload['tmp_name'])) unlink($upload['tmp_name']);
        }
    }

    /** @return array{tmp_name: string, size: int, error: int, name: string, type: string} */
    private function pngUpload(int $width, int $height): array
    {
        $path = tempnam(sys_get_temp_dir(), 'gift-png-');
        $image = imagecreatetruecolor($width, $height);
        imagefill($image, 0, 0, imagecolorallocate($image, 20, 90, 50));
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

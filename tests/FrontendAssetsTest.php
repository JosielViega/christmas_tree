<?php

declare(strict_types=1);

namespace Tests;

use App\Core\FrontendAssets;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class FrontendAssetsTest extends TestCase
{
    private string $manifest;

    protected function setUp(): void
    {
        $this->manifest = sys_get_temp_dir() . '/vite-manifest-' . bin2hex(random_bytes(6)) . '.json';
    }

    protected function tearDown(): void
    {
        if (is_file($this->manifest)) {
            unlink($this->manifest);
        }
    }

    public function testReturnsVersionedScriptAndStyles(): void
    {
        file_put_contents($this->manifest, json_encode([
            'index.html' => [
                'file' => 'assets/index-abc.js',
                'css' => ['assets/index-def.css'],
            ],
        ], JSON_THROW_ON_ERROR));

        $entry = (new FrontendAssets($this->manifest))->entry('index.html');

        self::assertSame('/assets/app/assets/index-abc.js', $entry['script']);
        self::assertSame(['/assets/app/assets/index-def.css'], $entry['styles']);
    }

    public function testExplainsHowToBuildWhenManifestIsMissing(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('npm --prefix frontend run build');

        (new FrontendAssets($this->manifest))->entry('index.html');
    }
}

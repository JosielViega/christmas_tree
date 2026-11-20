<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

final class HostgatorDeployManifestTest extends TestCase
{
    private array $manifest;

    protected function setUp(): void
    {
        $this->manifest = require dirname(__DIR__) . '/deploy/hostgator/config/deploy.php';
    }

    public function testProductionAllowlistContainsRequiredApplicationItems(): void
    {
        foreach (['app', 'bin/cleanup-gift-drafts.php', 'bootstrap', 'config', 'public/assets', 'public/index.php', 'resources', 'routes', 'storage/private/.gitkeep', 'composer.json', 'composer.lock'] as $item) {
            self::assertContains($item, $this->manifest['include']);
        }
    }

    public function testSensitiveAndServerOwnedItemsAreProtected(): void
    {
        foreach (['.env', '.env.example', '.htaccess', '.user.ini', 'php.ini', 'error_log'] as $item) {
            self::assertContains($item, $this->manifest['protected_names']);
        }

        foreach (['tests', 'frontend', 'node_modules', 'public/uploads', 'storage/logs', 'storage/cache', 'storage/private/gift-textures', 'vendor'] as $item) {
            self::assertContains($item, $this->manifest['ignore']);
        }
    }

    public function testCertificateAndLogExtensionsAreProtected(): void
    {
        foreach (['log', 'pem', 'key', 'crt', 'p12', 'pfx'] as $extension) {
            self::assertContains($extension, $this->manifest['protected_extensions']);
        }
    }
}

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
        foreach (['app', 'bin/cleanup-gift-drafts.php', 'bin/lib/ProcessLock.php', 'bin/migrate.php', 'bin/migrations-status.php', 'bootstrap', 'config', 'public/assets', 'public/.htaccess', 'public/index.php', 'resources', 'routes', 'storage/private/.gitkeep', 'composer.json', 'composer.lock'] as $item) {
            self::assertContains($item, $this->manifest['include']);
        }
    }

    public function testSensitiveAndServerOwnedItemsAreProtected(): void
    {
        foreach (['.env', '.env.example', '.htaccess', '.user.ini', 'php.ini', 'error_log'] as $item) {
            self::assertContains($item, $this->manifest['protected_names']);
        }

        self::assertContains('public/.htaccess', $this->manifest['allowed_server_files']);

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

    public function testPublicApacheRulesPreserveWebhookQueriesAndAddSecurityHeaders(): void
    {
        $rules = (string) file_get_contents(dirname(__DIR__) . '/public/.htaccess');

        self::assertStringContainsString('RewriteRule ^ index.php [QSA,L]', $rules);
        self::assertStringContainsString('Options -Indexes', $rules);
        self::assertStringContainsString('X-Content-Type-Options "nosniff"', $rules);
        self::assertStringContainsString('Content-Security-Policy', $rules);
        self::assertStringContainsString('Strict-Transport-Security', $rules);
    }

    public function testStagingTemplateKeepsPaymentsAndDebugDisabled(): void
    {
        $template = (string) file_get_contents(dirname(__DIR__) . '/deploy/hostgator/config/staging.env.example');

        self::assertStringContainsString('APP_ENV=staging', $template);
        self::assertStringContainsString('APP_DEBUG=false', $template);
        self::assertStringContainsString('PAYMENTS_ENABLED=false', $template);
        self::assertStringContainsString('PAYMENTS_ALLOW_PRODUCTION=false', $template);
        self::assertStringContainsString('PAYMENTS_SANDBOX_APRO=false', $template);
        self::assertContains('MERCADOPAGO_ACCESS_TOKEN=', preg_split('/\R/', $template));
        self::assertContains('MERCADOPAGO_WEBHOOK_SECRET=', preg_split('/\R/', $template));
    }

    public function testSecretPatternsDoNotCrossAnEmptyEnvironmentValue(): void
    {
        $providerPrefix = 'MERCADOPAGO_';
        $emptyTemplate = $providerPrefix . "ACCESS_TOKEN=\n"
            . $providerPrefix . "WEBHOOK_SECRET=\n"
            . 'DB_' . "PASSWORD=\nNEXT_SETTING=not-a-secret\n";

        foreach ($this->manifest['secret_content_patterns'] as $pattern) {
            self::assertSame(0, preg_match($pattern, $emptyTemplate));
        }
    }
}

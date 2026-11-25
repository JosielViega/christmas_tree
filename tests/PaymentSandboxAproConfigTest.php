<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;
use RuntimeException;

final class PaymentSandboxAproConfigTest extends TestCase
{
    /** @var array<string, string|false> */
    private array $original = [];
    /** @var array<string, mixed> */
    private array $originalEnv = [];
    /** @var array<string, mixed> */
    private array $originalServer = [];

    protected function setUp(): void
    {
        foreach (['APP_ENV', 'PAYMENTS_ENVIRONMENT', 'PAYMENTS_ALLOW_PRODUCTION', 'PAYMENTS_SANDBOX_APRO'] as $key) {
            $this->original[$key] = getenv($key);
            $this->originalEnv[$key] = $_ENV[$key] ?? null;
            $this->originalServer[$key] = $_SERVER[$key] ?? null;
        }
    }

    protected function tearDown(): void
    {
        foreach ($this->original as $key => $value) {
            if ($this->originalEnv[$key] === null) unset($_ENV[$key]);
            else $_ENV[$key] = $this->originalEnv[$key];
            if ($this->originalServer[$key] === null) unset($_SERVER[$key]);
            else $_SERVER[$key] = $this->originalServer[$key];
            putenv($value === false ? $key : $key . '=' . $value);
        }
    }

    public function testEnablesAproOnlyForTestingSandboxWithProductionBlocked(): void
    {
        $config = $this->load('testing', 'sandbox', false, true);

        self::assertTrue($config['payments']['sandbox_apro']);
    }

    public function testRejectsAproOutsideTheIsolatedSafetyBoundary(): void
    {
        $this->expectException(RuntimeException::class);

        $this->load('local', 'sandbox', false, true);
    }

    public function testStagingIsRecognizedButCannotEnableTechnicalApro(): void
    {
        $config = $this->load('staging', 'sandbox', false, false);
        self::assertSame('staging', $config['environment']);
        self::assertFalse($config['payments']['sandbox_apro']);

        $this->expectException(RuntimeException::class);
        $this->load('staging', 'sandbox', false, true);
    }

    public function testProductionPermanentlyRejectsTechnicalApro(): void
    {
        $config = $this->load('production', 'production', false, false);
        self::assertFalse($config['payments']['sandbox_apro']);
        self::assertFalse($config['payments']['enabled']);

        $this->expectException(RuntimeException::class);
        $this->load('production', 'production', false, true);
    }

    public function testRejectsUnknownApplicationEnvironment(): void
    {
        $this->expectException(RuntimeException::class);
        $this->load('homologation-typo', 'sandbox', false, false);
    }

    public function testProcessEnvironmentOverridesLoadedEnvironmentArrays(): void
    {
        $_ENV['APP_ENV'] = 'local';
        $_SERVER['APP_ENV'] = 'local';
        putenv('APP_ENV=testing');
        putenv('PAYMENTS_ENVIRONMENT=sandbox');
        putenv('PAYMENTS_ALLOW_PRODUCTION=false');
        putenv('PAYMENTS_SANDBOX_APRO=true');

        $config = require dirname(__DIR__) . '/config/app.php';

        self::assertSame('testing', $config['environment']);
        self::assertTrue($config['payments']['sandbox_apro']);
    }

    /** @return array<string, mixed> */
    private function load(string $appEnvironment, string $paymentEnvironment, bool $allowProduction, bool $apro): array
    {
        $values = [
            'APP_ENV' => $appEnvironment,
            'PAYMENTS_ENVIRONMENT' => $paymentEnvironment,
            'PAYMENTS_ALLOW_PRODUCTION' => $allowProduction ? 'true' : 'false',
            'PAYMENTS_SANDBOX_APRO' => $apro ? 'true' : 'false',
        ];
        foreach ($values as $key => $value) {
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
            putenv($key . '=' . $value);
        }

        return require dirname(__DIR__) . '/config/app.php';
    }
}

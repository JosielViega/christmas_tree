<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

final class EnvironmentRateLimitConfigTest extends TestCase
{
    public function testTreeCreationLimitDefaultsToThirtyOnlyInLocalEnvironment(): void
    {
        $originalEnvironment = getenv('APP_ENV');
        $originalLimit = getenv('TREE_CREATE_RATE_LIMIT');
        $originalEnv = $_ENV;
        $originalServer = $_SERVER;

        try {
            $local = $this->loadConfig('local');
            $production = $this->loadConfig('production');
            $productionOverride = $this->loadConfig('production', '12');

            self::assertSame(30, $local['rate_limits']['tree_creation']['max_attempts']);
            self::assertSame(5, $production['rate_limits']['tree_creation']['max_attempts']);
            self::assertSame(12, $productionOverride['rate_limits']['tree_creation']['max_attempts']);
            self::assertSame(900, $local['rate_limits']['tree_creation']['window_seconds']);
            self::assertSame(900, $production['rate_limits']['tree_creation']['window_seconds']);
        } finally {
            $_ENV = $originalEnv;
            $_SERVER = $originalServer;
            $this->restoreProcessEnvironment('APP_ENV', $originalEnvironment);
            $this->restoreProcessEnvironment('TREE_CREATE_RATE_LIMIT', $originalLimit);
        }
    }

    /** @return array<string, mixed> */
    private function loadConfig(string $environment, ?string $limit = null): array
    {
        $_ENV['APP_ENV'] = $environment;
        $_SERVER['APP_ENV'] = $environment;
        putenv('APP_ENV=' . $environment);

        unset($_ENV['TREE_CREATE_RATE_LIMIT'], $_SERVER['TREE_CREATE_RATE_LIMIT']);
        putenv('TREE_CREATE_RATE_LIMIT');
        if ($limit !== null) {
            $_ENV['TREE_CREATE_RATE_LIMIT'] = $limit;
            $_SERVER['TREE_CREATE_RATE_LIMIT'] = $limit;
            putenv('TREE_CREATE_RATE_LIMIT=' . $limit);
        }

        return require dirname(__DIR__) . '/config/app.php';
    }

    private function restoreProcessEnvironment(string $key, string|false $value): void
    {
        putenv($value === false ? $key : $key . '=' . $value);
    }
}

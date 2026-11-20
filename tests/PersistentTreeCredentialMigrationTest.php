<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

final class PersistentTreeCredentialMigrationTest extends TestCase
{
    public function testMigrationStoresOnlyHashedExpiringRevocableCredentials(): void
    {
        $sql = (string) file_get_contents(
            dirname(__DIR__) . '/database/migrations/202611200004_create_tree_persistent_credentials.sql'
        );

        self::assertStringContainsString('CREATE TABLE christmas_tree_persistent_credentials', $sql);
        self::assertStringContainsString('selector CHAR(22)', $sql);
        self::assertStringContainsString('verifier_hash CHAR(64)', $sql);
        self::assertStringContainsString('expires_at DATETIME(6)', $sql);
        self::assertStringContainsString('revoked_at DATETIME(6)', $sql);
        self::assertStringContainsString('FOREIGN KEY (tree_id)', $sql);
        self::assertStringNotContainsString('verifier CHAR', $sql);
    }
}

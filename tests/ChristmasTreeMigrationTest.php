<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

final class ChristmasTreeMigrationTest extends TestCase
{
    public function testMigrationDefinesUniquePublicIdentityAndHashedCredentials(): void
    {
        $sql = (string) file_get_contents(
            dirname(__DIR__) . '/database/migrations/202611190001_create_christmas_trees.sql'
        );

        self::assertStringContainsString('CREATE TABLE christmas_trees', $sql);
        self::assertStringContainsString('UNIQUE KEY christmas_trees_public_id_unique (public_id)', $sql);
        self::assertStringContainsString('admin_token_hash CHAR(64)', $sql);
        self::assertStringContainsString('recovery_token_hash CHAR(64)', $sql);
        self::assertStringNotContainsString('admin_token ', $sql);
        self::assertStringNotContainsString('recovery_token ', $sql);
        self::assertStringNotContainsString('ornament', strtolower($sql));
        self::assertStringNotContainsString('message', strtolower($sql));
    }
}

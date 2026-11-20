<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

final class ChristmasTreeGiftMigrationTest extends TestCase
{
    public function testGiftSchemaKeepsDraftsPrivateAndIndexed(): void
    {
        $sql = (string) file_get_contents(dirname(__DIR__) . '/database/migrations/202611200001_create_christmas_tree_gifts.sql');
        self::assertStringContainsString('CREATE TABLE christmas_tree_gifts', $sql);
        self::assertStringContainsString('access_token_hash CHAR(64)', $sql);
        self::assertStringContainsString('idempotency_key_hash CHAR(64)', $sql);
        self::assertStringContainsString('payload_hash CHAR(64)', $sql);
        self::assertStringContainsString("CHECK (status IN ('draft', 'paid', 'published', 'cancelled', 'expired'))", $sql);
        self::assertStringContainsString('FOREIGN KEY (tree_id) REFERENCES christmas_trees (id) ON DELETE CASCADE', $sql);
        self::assertStringContainsString('idx_christmas_tree_gifts_cleanup', $sql);
        self::assertStringNotContainsString('card', strtolower($sql));
        self::assertStringNotContainsString('price', strtolower($sql));
    }
}

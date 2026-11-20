<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

final class GiftPublicationMigrationTest extends TestCase
{
    public function testAddsStablePositionsIntegrityAndModerationWithoutChangingFinancialTables(): void
    {
        $sql = (string) file_get_contents(dirname(__DIR__) . '/database/migrations/202611200003_publish_christmas_tree_gifts.sql');
        self::assertStringContainsString('texture_sha256 CHAR(64)', $sql);
        self::assertStringContainsString('position_index SMALLINT UNSIGNED', $sql);
        self::assertStringContainsString('layout_version TINYINT UNSIGNED', $sql);
        self::assertStringContainsString('is_visible TINYINT(1)', $sql);
        self::assertStringContainsString('UNIQUE KEY uq_christmas_tree_gifts_position', $sql);
        self::assertStringNotContainsString('DROP ', strtoupper($sql));
        self::assertStringNotContainsString('christmas_tree_gift_orders', $sql);
    }
}

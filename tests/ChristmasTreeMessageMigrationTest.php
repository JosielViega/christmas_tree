<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

final class ChristmasTreeMessageMigrationTest extends TestCase
{
    public function testIncrementalMigrationDefinesOneToOneCascadeAndUtf8Storage(): void
    {
        $sql = file_get_contents(dirname(__DIR__) . '/database/migrations/202611190003_create_christmas_tree_messages.sql');

        self::assertIsString($sql);
        self::assertStringContainsString('message VARCHAR(500) NOT NULL', $sql);
        self::assertStringContainsString('UNIQUE KEY christmas_tree_messages_ornament_unique (ornament_id)', $sql);
        self::assertStringContainsString('FOREIGN KEY (ornament_id) REFERENCES christmas_tree_ornaments (id) ON DELETE CASCADE', $sql);
        self::assertStringContainsString('DEFAULT CHARSET=utf8mb4', $sql);
        self::assertStringContainsString('payload_hash CHAR(64)', $sql);
    }
}

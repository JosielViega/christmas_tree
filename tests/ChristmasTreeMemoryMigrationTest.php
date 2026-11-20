<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

final class ChristmasTreeMemoryMigrationTest extends TestCase
{
    public function testMigrationDefinesSeparatedStableSixSlotLayout(): void
    {
        $sql = (string) file_get_contents(dirname(__DIR__) . '/database/migrations/202611200005_create_christmas_tree_memories.sql');
        self::assertStringContainsString('CREATE TABLE christmas_tree_memories', $sql);
        self::assertStringContainsString('UNIQUE KEY uq_christmas_tree_memories_slot (tree_id, slot_index)', $sql);
        self::assertStringContainsString('CHECK (slot_index < 6)', $sql);
        self::assertStringContainsString('ON DELETE CASCADE', $sql);
        self::assertStringNotContainsString('message', strtolower($sql));
        self::assertStringNotContainsString('gift', strtolower($sql));
    }
}

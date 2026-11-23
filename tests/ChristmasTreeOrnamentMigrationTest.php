<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

final class ChristmasTreeOrnamentMigrationTest extends TestCase
{
    public function testMigrationDefinesOwnershipSlotsIdempotencyAndNoFutureContent(): void
    {
        $sql = file_get_contents(dirname(__DIR__) . '/database/migrations/202611190002_create_christmas_tree_ornaments.sql');

        self::assertIsString($sql);
        self::assertStringContainsString('FOREIGN KEY (tree_id) REFERENCES christmas_trees (id) ON DELETE CASCADE', $sql);
        self::assertStringContainsString('UNIQUE KEY christmas_tree_ornaments_tree_slot_unique (tree_id, slot_index)', $sql);
        self::assertStringContainsString('UNIQUE KEY christmas_tree_ornaments_tree_idempotency_unique (tree_id, idempotency_key_hash)', $sql);
        self::assertStringContainsString('CHECK (slot_index < 60)', $sql);
        self::assertStringContainsString('CHECK (layout_version = 1)', $sql);
        self::assertStringNotContainsString('message', strtolower($sql));
        self::assertStringNotContainsString('photo', strtolower($sql));
    }

    public function testRepositorySerializesConcurrentAllocationBeforeChoosingSlot(): void
    {
        $source = file_get_contents(dirname(__DIR__) . '/app/Repositories/PdoChristmasTreeOrnamentRepository.php');

        self::assertIsString($source);
        self::assertStringContainsString('beginTransaction()', $source);
        self::assertStringContainsString('SELECT status FROM christmas_trees WHERE id = :id FOR UPDATE', $source);
        self::assertStringContainsString('idempotency_key_hash = :key_hash', $source);
        self::assertStringContainsString('$pdo->rollBack()', $source);
        self::assertStringContainsString('hasVisitorParticipated', $source);
        self::assertStringContainsString('christmas_tree_visitor_participations', $source);
    }
}

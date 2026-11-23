<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

final class VisitorParticipationMigrationTest extends TestCase
{
    public function testMigrationPreservesLegacyOrnamentsAndEnforcesPerTreeUniqueness(): void
    {
        $sql = file_get_contents(dirname(__DIR__) . '/database/migrations/202611230001_create_visitor_participations.sql');
        self::assertIsString($sql);
        self::assertStringContainsString('CREATE TABLE christmas_tree_visitor_identities', $sql);
        self::assertStringContainsString('UNIQUE KEY uq_tree_visitor_participation (tree_id, visitor_identity_id)', $sql);
        self::assertStringContainsString('ON DELETE SET NULL', $sql);
        self::assertStringNotContainsString('ALTER TABLE christmas_tree_ornaments', $sql);
        self::assertStringNotContainsString('christmas_tree_gifts', $sql);
    }
}

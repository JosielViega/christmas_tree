<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

final class PaymentMigrationTest extends TestCase
{
    public function testCreatesImmutableOrdersAndIdempotentEventsWithoutSensitiveBuyerData(): void
    {
        $sql = (string) file_get_contents(dirname(__DIR__) . '/database/migrations/202611200002_create_christmas_tree_gift_orders.sql');
        self::assertStringContainsString('christmas_tree_gift_orders', $sql);
        self::assertStringContainsString('amount_cents INT UNSIGNED', $sql);
        self::assertStringContainsString('UNIQUE KEY uq_christmas_tree_gift_orders_gift', $sql);
        self::assertStringContainsString('christmas_tree_payment_events', $sql);
        self::assertStringContainsString('UNIQUE KEY uq_christmas_tree_payment_events_provider_key', $sql);
        self::assertStringNotContainsString('payer_email', $sql);
        self::assertStringNotContainsString('access_token', $sql);
    }
}

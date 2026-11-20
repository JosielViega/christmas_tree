<?php

declare(strict_types=1);

namespace Tests;

use App\Domain\PaymentOrderStatus;
use PHPUnit\Framework\TestCase;

final class PaymentOrderStatusTest extends TestCase
{
    public function testAllowsOnlyForwardFinancialTransitions(): void
    {
        foreach (['paid', 'expired', 'cancelled', 'failed', 'refunded'] as $status) {
            self::assertTrue(PaymentOrderStatus::canTransition('pending', $status));
        }
        self::assertTrue(PaymentOrderStatus::canTransition('paid', 'refunded'));
        self::assertFalse(PaymentOrderStatus::canTransition('paid', 'pending'));
        self::assertFalse(PaymentOrderStatus::canTransition('refunded', 'paid'));
        self::assertFalse(PaymentOrderStatus::canTransition('expired', 'pending'));
        self::assertFalse(PaymentOrderStatus::canTransition('failed', 'paid'));
    }
}

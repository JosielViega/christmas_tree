<?php

declare(strict_types=1);

namespace App\Domain;

final class PaymentOrderStatus
{
    public const PENDING = 'pending';
    public const PAID = 'paid';
    public const EXPIRED = 'expired';
    public const CANCELLED = 'cancelled';
    public const REFUNDED = 'refunded';
    public const FAILED = 'failed';

    public static function canTransition(string $from, string $to): bool
    {
        if ($from === $to) return true;
        if ($from === self::PENDING) return in_array($to, [self::PAID, self::EXPIRED, self::CANCELLED, self::FAILED, self::REFUNDED], true);
        return $from === self::PAID && $to === self::REFUNDED;
    }
}

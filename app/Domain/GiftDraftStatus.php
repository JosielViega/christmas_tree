<?php

declare(strict_types=1);

namespace App\Domain;

final class GiftDraftStatus
{
    public const DRAFT = 'draft';
    public const PAID = 'paid';
    public const PUBLISHED = 'published';
    public const CANCELLED = 'cancelled';
    public const EXPIRED = 'expired';

    public static function canTransition(string $from, string $to): bool
    {
        if ($from === self::DRAFT) return in_array($to, [self::PAID, self::CANCELLED, self::EXPIRED], true);
        return $from === self::PAID && $to === self::PUBLISHED;
    }

    public static function isPublic(string $status): bool
    {
        return $status === self::PUBLISHED;
    }
}

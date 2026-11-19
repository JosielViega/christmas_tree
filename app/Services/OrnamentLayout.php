<?php

declare(strict_types=1);

namespace App\Services;

final class OrnamentLayout
{
    public const VERSION = 1;
    public const SLOT_COUNT = 60;

    public static function acceptsSlot(int $slot): bool
    {
        return $slot >= 0 && $slot < self::SLOT_COUNT;
    }
}

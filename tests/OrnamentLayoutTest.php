<?php

declare(strict_types=1);

namespace Tests;

use App\Services\OrnamentLayout;
use PHPUnit\Framework\TestCase;

final class OrnamentLayoutTest extends TestCase
{
    public function testVersionOneContractHasExactlySixtyStableIndices(): void
    {
        self::assertSame(1, OrnamentLayout::VERSION);
        self::assertSame(60, OrnamentLayout::SLOT_COUNT);
        self::assertTrue(OrnamentLayout::acceptsSlot(0));
        self::assertTrue(OrnamentLayout::acceptsSlot(59));
        self::assertFalse(OrnamentLayout::acceptsSlot(-1));
        self::assertFalse(OrnamentLayout::acceptsSlot(60));
    }
}

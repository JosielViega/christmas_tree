<?php

declare(strict_types=1);

namespace Tests;

use App\Services\GiftPublicationService;
use PHPUnit\Framework\TestCase;

final class GiftPublicationLayoutTest extends TestCase
{
    public function testNewPublicationsUseVersionTwoWithoutChangingTheVisibleLimit(): void
    {
        self::assertSame(2, GiftPublicationService::LAYOUT_VERSION);
        self::assertSame(12, GiftPublicationService::VISIBLE_LIMIT);
    }
}

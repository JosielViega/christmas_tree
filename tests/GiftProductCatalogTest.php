<?php

declare(strict_types=1);

namespace Tests;

use App\Services\GiftProductCatalog;
use PHPUnit\Framework\TestCase;

final class GiftProductCatalogTest extends TestCase
{
    public function testKeepsServerControlledIntegerPricesAndVersion(): void
    {
        $catalog = new GiftProductCatalog(['special' => 199, 'personalized' => 399, 'magic' => 599], 'v-test');
        self::assertSame(199, $catalog->find('special')?->amountCents);
        self::assertSame('BRL', $catalog->find('personalized')?->currency);
        self::assertSame('v-test', $catalog->find('magic')?->priceVersion);
        self::assertNull($catalog->find('custom-price'));
        self::assertCount(3, $catalog->publicProducts());
    }
}

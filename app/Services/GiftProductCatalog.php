<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\GiftProduct;

final class GiftProductCatalog
{
    /** @var array<string, GiftProduct> */
    private array $products = [];

    /** @param array<string, int> $prices */
    public function __construct(array $prices, private readonly string $version = '2026-11')
    {
        $names = ['special' => 'Presente especial', 'personalized' => 'Presente personalizado', 'magic' => 'Presente mágico'];
        foreach ($names as $code => $name) {
            $amount = (int) ($prices[$code] ?? 0);
            if ($amount > 0) {
                $this->products[$code] = new GiftProduct($code, $name, $amount, 'BRL', $version);
            }
        }
    }

    public function find(string $code): ?GiftProduct
    {
        return $this->products[$code] ?? null;
    }

    /** @return list<array<string, int|string>> */
    public function publicProducts(): array
    {
        return array_values(array_map(static fn (GiftProduct $product): array => $product->toPublicArray(), $this->products));
    }
}

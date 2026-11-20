<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class GiftProduct
{
    public function __construct(
        public string $code,
        public string $name,
        public int $amountCents,
        public string $currency,
        public string $priceVersion,
    ) {
    }

    public function toPublicArray(): array
    {
        return ['code' => $this->code, 'name' => $this->name, 'amount_cents' => $this->amountCents, 'currency' => $this->currency];
    }
}

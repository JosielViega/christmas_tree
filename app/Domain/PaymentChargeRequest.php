<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class PaymentChargeRequest
{
    public function __construct(
        public string $externalReference, public int $amountCents, public string $currency,
        public string $payerEmail, public string $idempotencyKey, public int $expirationMinutes,
    ) {
    }
}

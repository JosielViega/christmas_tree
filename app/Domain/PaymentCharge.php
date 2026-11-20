<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class PaymentCharge
{
    public function __construct(
        public string $providerOrderId, public ?string $providerPaymentId, public string $externalReference,
        public int $amountCents, public string $currency, public string $status, public bool $liveMode,
        public ?string $qrCode, public ?string $qrCodeBase64, public ?string $ticketUrl,
    ) {
    }
}

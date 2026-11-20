<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class PaymentOrder
{
    public function __construct(
        public int $id, public string $publicId, public int $giftId, public string $productCode,
        public int $amountCents, public string $currency, public string $priceVersion, public string $provider,
        public ?string $providerOrderId, public ?string $providerPaymentId, public string $status,
        public ?string $pixQrCode, public ?string $pixQrCodeBase64, public ?string $pixTicketUrl,
        public string $createdAt, public string $updatedAt, public string $expiresAt, public ?string $paidAt,
    ) {
    }

    public function toPrivateArray(string $productName): array
    {
        return [
            'public_id' => $this->publicId, 'product_code' => $this->productCode, 'product_name' => $productName,
            'amount_cents' => $this->amountCents, 'currency' => $this->currency, 'status' => $this->status,
            'pix_qr_code' => $this->pixQrCode, 'pix_qr_code_base64' => $this->pixQrCodeBase64,
            'pix_ticket_url' => $this->pixTicketUrl, 'expires_at' => $this->expiresAt, 'paid_at' => $this->paidAt,
        ];
    }
}

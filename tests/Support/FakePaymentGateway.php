<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Domain\PaymentCharge;
use App\Domain\PaymentChargeRequest;
use App\Domain\PaymentGatewayException;
use App\Domain\PaymentNotification;
use App\Payments\PaymentGateway;

final class FakePaymentGateway implements PaymentGateway
{
    public bool $available = true;
    public int $createCalls = 0;
    public ?PaymentCharge $charge = null;
    public bool $signatureValid = true;
    public ?PaymentGatewayException $createFailure = null;

    public function provider(): string { return 'mercadopago'; }
    public function isAvailable(): bool { return $this->available; }
    public function createCharge(PaymentChargeRequest $request): PaymentCharge
    {
        $this->createCalls++;
        if ($this->createFailure !== null) throw $this->createFailure;
        return $this->charge ?? new PaymentCharge('ORD_TEST_123', 'PAY_TEST_123', $request->externalReference, $request->amountCents, $request->currency, 'pending', false, 'PIX-CODE', null, 'https://www.mercadopago.com.br/sandbox/ticket');
    }
    public function fetchCharge(string $providerOrderId): PaymentCharge
    {
        if ($this->charge === null) throw new \RuntimeException('Fake charge not configured.');
        return $this->charge;
    }
    public function verifyNotification(string $signature, string $requestId, string $resourceId): bool { return $this->signatureValid; }
    public function interpretNotification(string $rawBody, string $resourceId): ?PaymentNotification
    {
        return new PaymentNotification($resourceId, hash('sha256', $rawBody), 'order.updated', false);
    }
}

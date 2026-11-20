<?php

declare(strict_types=1);

namespace App\Payments;

use App\Domain\PaymentCharge;
use App\Domain\PaymentChargeRequest;
use App\Domain\PaymentNotification;

interface PaymentGateway
{
    public function provider(): string;
    public function isAvailable(): bool;
    public function createCharge(PaymentChargeRequest $request): PaymentCharge;
    public function fetchCharge(string $providerOrderId): PaymentCharge;
    public function verifyNotification(string $signature, string $requestId, string $resourceId): bool;
    public function interpretNotification(string $rawBody, string $resourceId): ?PaymentNotification;
}

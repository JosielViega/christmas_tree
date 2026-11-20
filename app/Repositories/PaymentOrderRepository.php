<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Domain\PaymentCharge;
use App\Domain\PaymentNotification;
use App\Domain\PaymentOrder;
use App\Domain\PaymentOrderPersistence;

interface PaymentOrderRepository
{
    /** @param array<string, int|string> $attributes */
    public function createOrFind(int $giftId, array $attributes): PaymentOrderPersistence;
    public function findByGiftId(int $giftId): ?PaymentOrder;
    public function findByPublicId(string $publicId): ?PaymentOrder;
    public function findByProviderOrderId(string $provider, string $providerOrderId): ?PaymentOrder;
    public function applyCharge(int $orderId, PaymentCharge $charge, string $now, ?PaymentNotification $notification = null): PaymentOrder;
    public function markFailedIfUnbound(int $orderId, string $now): void;
    /** @return list<PaymentOrder> */
    public function pendingForReconciliation(int $limit): array;
}

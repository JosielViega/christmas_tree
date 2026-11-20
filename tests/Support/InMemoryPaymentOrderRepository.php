<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Domain\IdempotencyConflict;
use App\Domain\PaymentCharge;
use App\Domain\PaymentNotification;
use App\Domain\PaymentOrder;
use App\Domain\PaymentOrderPersistence;
use App\Domain\PaymentOrderStatus;
use App\Repositories\PaymentOrderRepository;

final class InMemoryPaymentOrderRepository implements PaymentOrderRepository
{
    /** @var array<int, PaymentOrder> */
    public array $orders = [];
    /** @var array<int, string> */
    private array $requestHashes = [];
    /** @var array<string, true> */
    private array $events = [];
    private int $nextId = 1;

    public function createOrFind(int $giftId, array $attributes): PaymentOrderPersistence
    {
        $existing = $this->findByGiftId($giftId);
        if ($existing !== null) {
            if (!hash_equals($this->requestHashes[$existing->id], (string) $attributes['request_hash'])) throw new IdempotencyConflict();
            return new PaymentOrderPersistence($existing, false);
        }
        $order = new PaymentOrder(
            $this->nextId++, (string) $attributes['public_id'], $giftId, (string) $attributes['product_code'],
            (int) $attributes['amount_cents'], (string) $attributes['currency'], (string) $attributes['price_version'],
            (string) $attributes['provider'], null, null, (string) $attributes['status'], null, null, null,
            (string) $attributes['created_at'], (string) $attributes['updated_at'], (string) $attributes['expires_at'], null,
        );
        $this->orders[$order->id] = $order;
        $this->requestHashes[$order->id] = (string) $attributes['request_hash'];
        return new PaymentOrderPersistence($order, true);
    }

    public function findByGiftId(int $giftId): ?PaymentOrder
    {
        foreach ($this->orders as $order) if ($order->giftId === $giftId) return $order;
        return null;
    }

    public function findByPublicId(string $publicId): ?PaymentOrder
    {
        foreach ($this->orders as $order) if ($order->publicId === $publicId) return $order;
        return null;
    }

    public function findByProviderOrderId(string $provider, string $providerOrderId): ?PaymentOrder
    {
        foreach ($this->orders as $order) if ($order->provider === $provider && $order->providerOrderId === $providerOrderId) return $order;
        return null;
    }

    public function applyCharge(int $orderId, PaymentCharge $charge, string $now, ?PaymentNotification $notification = null): PaymentOrder
    {
        $order = $this->orders[$orderId];
        if ($notification !== null && isset($this->events[$notification->eventKey])) return $order;
        if ($notification !== null) $this->events[$notification->eventKey] = true;
        $status = PaymentOrderStatus::canTransition($order->status, $charge->status) ? $charge->status : $order->status;
        return $this->orders[$orderId] = new PaymentOrder(
            $order->id, $order->publicId, $order->giftId, $order->productCode, $order->amountCents, $order->currency,
            $order->priceVersion, $order->provider, $charge->providerOrderId, $charge->providerPaymentId, $status,
            $charge->qrCode ?? $order->pixQrCode, $charge->qrCodeBase64 ?? $order->pixQrCodeBase64,
            $charge->ticketUrl ?? $order->pixTicketUrl, $order->createdAt, $now, $order->expiresAt,
            $status === 'paid' ? ($order->paidAt ?? $now) : $order->paidAt,
        );
    }

    public function pendingForReconciliation(int $limit): array
    {
        return array_slice(array_values(array_filter($this->orders, static fn (PaymentOrder $order): bool => $order->status === 'pending' && $order->providerOrderId !== null)), 0, $limit);
    }

    public function markFailedIfUnbound(int $orderId, string $now): void
    {
        $order = $this->orders[$orderId] ?? null;
        if ($order === null || $order->status !== 'pending' || $order->providerOrderId !== null) return;
        $this->orders[$orderId] = new PaymentOrder(
            $order->id, $order->publicId, $order->giftId, $order->productCode, $order->amountCents, $order->currency,
            $order->priceVersion, $order->provider, null, null, 'failed', $order->pixQrCode,
            $order->pixQrCodeBase64, $order->pixTicketUrl, $order->createdAt, $now, $order->expiresAt, $order->paidAt,
        );
    }
}

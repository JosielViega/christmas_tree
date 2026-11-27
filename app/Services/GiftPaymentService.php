<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\GiftDraftStatus;
use App\Domain\PaymentCharge;
use App\Domain\PaymentChargeRequest;
use App\Domain\PaymentGatewayException;
use App\Domain\PaymentOrder;
use App\Domain\PaymentOrderStatus;
use App\Domain\PaymentValidationException;
use App\Payments\PaymentGateway;
use App\Repositories\PaymentOrderRepository;
use Closure;
use DateTimeImmutable;
use DateTimeZone;
use RuntimeException;

final class GiftPaymentService
{
    private readonly Closure $clock;

    public function __construct(
        private readonly ChristmasTreeGiftService $gifts,
        private readonly PaymentOrderRepository $orders,
        private readonly GiftProductCatalog $catalog,
        private readonly PaymentGateway $gateway,
        private readonly int $expirationMinutes = 1440,
        private readonly bool $expectedLiveMode = false,
        ?callable $clock = null,
        private readonly ?GiftPublicationService $publisher = null,
    ) {
        $this->clock = $clock === null
            ? static fn (): DateTimeImmutable => new DateTimeImmutable('now', new DateTimeZone('UTC'))
            : Closure::fromCallable($clock);
    }

    public function available(): bool { return $this->gateway->isAvailable(); }
    public function products(): array { return $this->catalog->publicProducts(); }
    public function recipientTreeIdForAccess(string $giftPublicId, string $accessToken): ?int
    {
        return $this->gifts->recipientTreeIdForAccess($giftPublicId, $accessToken);
    }

    public function create(string $giftPublicId, string $accessToken, string $productCode, string $payerEmail, string $idempotencyKey): ?PaymentOrder
    {
        if (!$this->available()) throw new PaymentGatewayException('Payments are not configured.', false);
        $gift = $this->gifts->findAuthorized($giftPublicId, $accessToken);
        if ($gift === null) return null;
        if ($gift->status !== GiftDraftStatus::DRAFT) {
            $existing = $this->orders->findByGiftId($gift->id);
            if ($existing !== null) return $existing;
            throw new PaymentValidationException(['gift' => ['O rascunho não aceita um novo pagamento.']]);
        }
        $product = $this->catalog->find($productCode);
        $email = strtolower(trim($payerEmail));
        $errors = [];
        if ($product === null) $errors['product_code'][] = 'Escolha um produto válido.';
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || strlen($email) > 160) $errors['payer_email'][] = 'Informe um e-mail válido para o pagamento Pix.';
        if (preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $idempotencyKey) !== 1) $errors['idempotency_key'][] = 'A chave de envio é inválida.';
        if ($errors !== []) throw new PaymentValidationException($errors);
        if ($product === null) throw new RuntimeException('Validated product is missing.');

        $now = ($this->clock)();
        $requestHash = hash('sha256', implode('|', [$product->code, hash('sha256', $email)]));
        $persistence = $this->orders->createOrFind($gift->id, [
            'public_id' => $this->randomPublicId(), 'product_code' => $product->code,
            'amount_cents' => $product->amountCents, 'currency' => $product->currency,
            'price_version' => $product->priceVersion, 'provider' => $this->gateway->provider(),
            'status' => PaymentOrderStatus::PENDING, 'idempotency_key_hash' => hash('sha256', $idempotencyKey),
            'request_hash' => $requestHash, 'created_at' => $this->format($now), 'updated_at' => $this->format($now),
            'expires_at' => $this->format($now->modify('+' . $this->boundedExpiration() . ' minutes')),
        ]);
        $order = $persistence->order;
        if ($order->providerOrderId !== null) return $order;
        if ($order->status !== PaymentOrderStatus::PENDING) return $order;

        try {
            $charge = $this->gateway->createCharge(new PaymentChargeRequest(
                $order->publicId, $order->amountCents, $order->currency, $email,
                'ct-' . $order->publicId, $this->boundedExpiration(),
            ));
        } catch (PaymentGatewayException $exception) {
            if (!$exception->retryable) $this->orders->markFailedIfUnbound($order->id, $this->format(($this->clock)()));
            throw $exception;
        }
        $this->validateCharge($order, $charge);
        $updated = $this->orders->applyCharge($order->id, $charge, $this->format(($this->clock)()));
        $this->publishAfterConfirmation($updated);
        return $updated;
    }

    public function findAuthorized(string $giftPublicId, string $accessToken): ?PaymentOrder
    {
        $gift = $this->gifts->findAuthorized($giftPublicId, $accessToken);
        return $gift === null ? null : $this->orders->findByGiftId($gift->id);
    }

    public function processNotification(string $signature, string $requestId, string $resourceId, string $rawBody): bool
    {
        if (!$this->available() || !$this->gateway->verifyNotification($signature, $requestId, $resourceId)) return false;
        $notification = $this->gateway->interpretNotification($rawBody, $resourceId);
        if ($notification === null || $notification->liveMode !== $this->expectedLiveMode) return false;
        $charge = $this->gateway->fetchCharge($notification->resourceId);
        $order = $this->orders->findByProviderOrderId($this->gateway->provider(), $charge->providerOrderId)
            ?? $this->orders->findByPublicId($charge->externalReference);
        if ($order === null) return true;
        $this->validateCharge($order, $charge);
        $updated = $this->orders->applyCharge($order->id, $charge, $this->format(($this->clock)()), $notification);
        $this->publishAfterConfirmation($updated);
        return true;
    }

    public function reconcilePending(int $limit = 20): int
    {
        if (!$this->available()) return 0;
        $count = 0;
        foreach ($this->orders->pendingForReconciliation($limit) as $order) {
            if ($order->providerOrderId === null) continue;
            try {
                $charge = $this->gateway->fetchCharge($order->providerOrderId);
                $this->validateCharge($order, $charge);
                $updated = $this->orders->applyCharge($order->id, $charge, $this->format(($this->clock)()));
                $this->publishAfterConfirmation($updated);
                $count++;
            } catch (PaymentGatewayException) {
                continue;
            }
        }
        return $count;
    }

    public function publicationStatus(string $giftPublicId, string $accessToken): ?string
    {
        return $this->gifts->findAuthorized($giftPublicId, $accessToken)?->status;
    }

    private function publishAfterConfirmation(PaymentOrder $order): void
    {
        if ($order->status !== PaymentOrderStatus::PAID || $this->publisher === null) return;
        try {
            $record = $this->gifts->findAuthorizedById($order->giftId);
            if ($record !== null) $this->publisher->publish($record->publicId);
        } catch (RuntimeException) {
            // The paid record remains eligible for the idempotent cron reconciliation.
        }
    }

    private function validateCharge(PaymentOrder $order, PaymentCharge $charge): void
    {
        if ($charge->externalReference !== $order->publicId || $charge->amountCents !== $order->amountCents
            || $charge->currency !== $order->currency || $charge->liveMode !== $this->expectedLiveMode) {
            throw new PaymentGatewayException('Provider charge did not match the local order.', false);
        }
        if ($order->providerOrderId !== null && !hash_equals($order->providerOrderId, $charge->providerOrderId)) {
            throw new PaymentGatewayException('Provider order identity changed.', false);
        }
    }

    private function boundedExpiration(): int { return max(30, min(43200, $this->expirationMinutes)); }
    private function randomPublicId(): string { return rtrim(strtr(base64_encode(random_bytes(12)), '+/', '-_'), '='); }
    private function format(DateTimeImmutable $date): string { return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u'); }
}

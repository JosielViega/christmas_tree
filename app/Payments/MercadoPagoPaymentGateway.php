<?php

declare(strict_types=1);

namespace App\Payments;

use App\Domain\PaymentCharge;
use App\Domain\PaymentChargeRequest;
use App\Domain\PaymentGatewayException;
use App\Domain\PaymentNotification;
use App\Domain\PaymentOrderStatus;

final class MercadoPagoPaymentGateway implements PaymentGateway
{
    private const BASE_URL = 'https://api.mercadopago.com';

    public function __construct(
        private readonly PaymentHttpClient $http,
        private readonly string $accessToken,
        private readonly string $webhookSecret,
        private readonly bool $sandbox,
        private readonly bool $enabled,
    ) {
    }

    public function provider(): string { return 'mercadopago'; }

    public function isAvailable(): bool
    {
        return $this->enabled && $this->accessToken !== '' && $this->webhookSecret !== '';
    }

    public function createCharge(PaymentChargeRequest $request): PaymentCharge
    {
        $payload = [
            'type' => 'online', 'total_amount' => $this->formatAmount($request->amountCents),
            'external_reference' => $request->externalReference, 'processing_mode' => 'automatic',
            'transactions' => ['payments' => [[
                'amount' => $this->formatAmount($request->amountCents),
                'payment_method' => ['id' => 'pix', 'type' => 'bank_transfer'],
                'expiration_time' => 'PT' . max(30, min(43200, $request->expirationMinutes)) . 'M',
            ]]],
            'payer' => ['email' => $request->payerEmail],
        ];
        return $this->send('POST', '/v1/orders', $payload, $request->idempotencyKey);
    }

    public function fetchCharge(string $providerOrderId): PaymentCharge
    {
        if (preg_match('/^[A-Za-z0-9_-]{8,80}$/D', $providerOrderId) !== 1) {
            throw new PaymentGatewayException('Invalid provider order identifier.', false);
        }
        return $this->send('GET', '/v1/orders/' . rawurlencode($providerOrderId));
    }

    public function verifyNotification(string $signature, string $requestId, string $resourceId): bool
    {
        if ($this->webhookSecret === '' || $requestId === '' || $resourceId === '') return false;
        $parts = [];
        foreach (explode(',', $signature) as $part) {
            [$key, $value] = array_pad(explode('=', trim($part), 2), 2, '');
            if ($key !== '' && $value !== '') $parts[$key] = $value;
        }
        $timestamp = $parts['ts'] ?? '';
        $received = $parts['v1'] ?? '';
        if (preg_match('/^\d{10,16}$/D', $timestamp) !== 1 || preg_match('/^[a-f0-9]{64}$/D', $received) !== 1) return false;
        $manifest = "id:{$resourceId};request-id:{$requestId};ts:{$timestamp};";
        return hash_equals(hash_hmac('sha256', $manifest, $this->webhookSecret), $received);
    }

    public function interpretNotification(string $rawBody, string $resourceId): ?PaymentNotification
    {
        try {
            $payload = json_decode($rawBody, true, 32, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }
        if (!is_array($payload) || ($payload['type'] ?? null) !== 'order' || (string) ($payload['data']['id'] ?? '') !== $resourceId
            || !array_key_exists('live_mode', $payload) || !is_bool($payload['live_mode'])) return null;
        $action = (string) ($payload['action'] ?? 'order.updated');
        $date = (string) ($payload['date_created'] ?? '');
        $version = (string) ($payload['data']['version'] ?? '');
        $eventKey = hash('sha256', implode('|', [$resourceId, $action, $date, $version]));
        return new PaymentNotification($resourceId, $eventKey, substr($action, 0, 80), $payload['live_mode']);
    }

    private function send(string $method, string $path, ?array $payload = null, ?string $idempotencyKey = null): PaymentCharge
    {
        if (!$this->isAvailable()) throw new PaymentGatewayException('Payment provider is not configured.', false);
        $headers = ['Accept: application/json', 'Authorization: Bearer ' . $this->accessToken];
        $body = null;
        if ($payload !== null) {
            $headers[] = 'Content-Type: application/json';
            $body = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        }
        if ($idempotencyKey !== null) $headers[] = 'X-Idempotency-Key: ' . $idempotencyKey;
        $response = $this->http->request($method, self::BASE_URL . $path, $headers, $body);
        if ($response->status < 200 || $response->status >= 300) {
            throw new PaymentGatewayException('Payment provider returned HTTP ' . $response->status . '.', $response->status >= 429);
        }
        try {
            $data = json_decode($response->body, true, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new PaymentGatewayException('Payment provider returned invalid JSON.');
        }
        if (!is_array($data)) throw new PaymentGatewayException('Payment provider returned an invalid response.');
        return $this->chargeFromResponse($data);
    }

    private function chargeFromResponse(array $data): PaymentCharge
    {
        $payment = $data['transactions']['payments'][0] ?? [];
        $method = is_array($payment) ? ($payment['payment_method'] ?? []) : [];
        $providerOrderId = (string) ($data['id'] ?? '');
        $externalReference = (string) ($data['external_reference'] ?? '');
        $country = (string) ($data['country_code'] ?? 'BRA');
        if (preg_match('/^[A-Za-z0-9_-]{8,80}$/D', $providerOrderId) !== 1 || $externalReference === '' || $country !== 'BRA') {
            throw new PaymentGatewayException('Payment provider response is incomplete.', false);
        }
        return new PaymentCharge(
            $providerOrderId, is_array($payment) && isset($payment['id']) ? (string) $payment['id'] : null,
            $externalReference, $this->parseAmount((string) ($data['total_amount'] ?? '')), 'BRL',
            $this->normalizeStatus((string) ($data['status'] ?? ''), (string) ($data['status_detail'] ?? '')),
            !$this->sandbox,
            is_array($method) && isset($method['qr_code']) ? substr((string) $method['qr_code'], 0, 8192) : null,
            is_array($method) && isset($method['qr_code_base64']) ? $this->validBase64((string) $method['qr_code_base64']) : null,
            is_array($method) && isset($method['ticket_url']) ? $this->validTicketUrl((string) $method['ticket_url']) : null,
        );
    }

    private function normalizeStatus(string $status, string $detail): string
    {
        return match (true) {
            $status === 'processed' && $detail === 'accredited' => PaymentOrderStatus::PAID,
            $status === 'refunded' || in_array($detail, ['refunded', 'partially_refunded', 'reimbursed'], true) => PaymentOrderStatus::REFUNDED,
            ($status === 'canceled' || $status === 'failed') && $detail === 'expired' => PaymentOrderStatus::EXPIRED,
            $status === 'canceled' => PaymentOrderStatus::CANCELLED,
            $status === 'failed' => PaymentOrderStatus::FAILED,
            default => PaymentOrderStatus::PENDING,
        };
    }

    private function parseAmount(string $amount): int
    {
        if (preg_match('/^(\d{1,9})\.(\d{2})$/D', $amount, $matches) !== 1) throw new PaymentGatewayException('Invalid provider amount.', false);
        return ((int) $matches[1] * 100) + (int) $matches[2];
    }

    private function formatAmount(int $cents): string { return intdiv($cents, 100) . '.' . str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT); }

    private function validBase64(string $value): ?string
    {
        if (strlen($value) > 1048576 || preg_match('/^[A-Za-z0-9+\/=]+$/D', $value) !== 1 || base64_decode($value, true) === false) return null;
        return $value;
    }

    private function validTicketUrl(string $url): ?string
    {
        if (strlen($url) > 1000 || filter_var($url, FILTER_VALIDATE_URL) === false || !str_starts_with($url, 'https://')) return null;
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        return ($host === 'mercadopago.com.br' || str_ends_with($host, '.mercadopago.com.br')) ? $url : null;
    }
}

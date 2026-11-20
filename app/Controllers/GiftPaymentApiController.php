<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Csrf;
use App\Core\Request;
use App\Core\Response;
use App\Domain\IdempotencyConflict;
use App\Domain\PaymentGatewayException;
use App\Domain\PaymentValidationException;
use App\Services\GiftDraftAccessSession;
use App\Services\GiftPaymentService;
use App\Services\GiftProductCatalog;
use App\Services\RateLimiter;

final class GiftPaymentApiController
{
    public function __construct(
        private readonly Request $request,
        private readonly Csrf $csrf,
        private readonly GiftPaymentService $payments,
        private readonly GiftProductCatalog $catalog,
        private readonly GiftDraftAccessSession $accessSession,
        private readonly RateLimiter $creationLimiter,
        private readonly int $maxWebhookBytes = 65536,
    ) {
    }

    public function catalog(): Response
    {
        return $this->privateJson(['data' => ['available' => $this->payments->available(), 'products' => $this->catalog->publicProducts()]]);
    }

    public function store(string $giftPublicId): Response
    {
        if ($this->request->contentLength() > 4096) {
            return $this->error('payload_too_large', 'A solicitação de pagamento excede o tamanho permitido.', 413);
        }
        if (!$this->csrf->verify($this->request->header('X-CSRF-Token', $this->request->input('_token')))) {
            return $this->error('csrf_failed', 'A sessão expirou. Recarregue a página e tente novamente.', 419);
        }
        if (!$this->creationLimiter->consume('gift-payment:' . $this->request->ipAddress())) {
            return $this->error('rate_limit_exceeded', 'Muitas tentativas de pagamento. Tente novamente mais tarde.', 429);
        }
        $token = $this->accessToken($giftPublicId);
        try {
            $order = $this->payments->create(
                $giftPublicId, $token, $this->stringInput('product_code'), $this->stringInput('payer_email'),
                is_string($this->request->header('Idempotency-Key')) ? $this->request->header('Idempotency-Key') : '',
            );
        } catch (PaymentValidationException $exception) {
            return $this->error('validation_failed', 'Revise os dados do pagamento.', 422, $exception->errors);
        } catch (IdempotencyConflict) {
            return $this->error('order_conflict', 'Este presente já possui um pedido com condições diferentes.', 409);
        } catch (PaymentGatewayException $exception) {
            return $this->error(
                $exception->retryable ? 'payment_provider_unavailable' : 'payments_unavailable',
                $exception->retryable ? 'O provedor de pagamento está temporariamente indisponível. Tente novamente.' : 'O pagamento Pix ainda não está disponível.',
                503,
            );
        }
        if ($order === null) return $this->privateError('gift_draft_not_found', 'Rascunho não encontrado ou acesso inválido.', 404);
        return $this->privateJson(['data' => ['order' => $this->orderData($order, $giftPublicId, $token)]], 201);
    }

    public function show(string $giftPublicId): Response
    {
        $order = $this->payments->findAuthorized($giftPublicId, $this->accessToken($giftPublicId));
        return $order === null
            ? $this->privateError('payment_order_not_found', 'Pedido não encontrado ou acesso inválido.', 404)
            : $this->privateJson(['data' => ['order' => $this->orderData($order, $giftPublicId, $this->accessToken($giftPublicId))]]);
    }

    public function webhook(): Response
    {
        if ($this->request->contentLength() > $this->maxWebhookBytes || strlen($this->request->rawBody()) > $this->maxWebhookBytes) {
            return $this->error('payload_too_large', 'Payload inválido.', 413);
        }
        $resourceId = (string) $this->request->query('data.id', $this->request->query('data_id', ''));
        $type = (string) $this->request->query('type', '');
        $signature = (string) $this->request->header('X-Signature', '');
        $requestId = (string) $this->request->header('X-Request-Id', '');
        if ($type !== 'order' || preg_match('/^[A-Za-z0-9_-]{8,80}$/D', $resourceId) !== 1) {
            return $this->error('invalid_notification', 'Notificação inválida.', 400);
        }
        try {
            $accepted = $this->payments->processNotification($signature, $requestId, $resourceId, $this->request->rawBody());
        } catch (PaymentGatewayException) {
            return $this->error('provider_confirmation_failed', 'Não foi possível confirmar a notificação.', 503);
        }
        return $accepted ? Response::json(['data' => ['accepted' => true]]) : $this->error('invalid_signature', 'Notificação inválida.', 401);
    }

    private function orderData(\App\Domain\PaymentOrder $order, string $giftPublicId, string $accessToken): array
    {
        $product = $this->catalog->find($order->productCode);
        return [
            ...$order->toPrivateArray($product?->name ?? $order->productCode),
            'publication_status' => $this->payments->publicationStatus($giftPublicId, $accessToken),
        ];
    }

    private function accessToken(string $publicId): string
    {
        $header = $this->request->header('X-Gift-Draft-Token');
        return is_string($header) && $header !== '' ? $header : ($this->accessSession->tokenFor($publicId) ?? '');
    }

    private function stringInput(string $key): string
    {
        $value = $this->request->input($key);
        return is_string($value) ? $value : '';
    }

    /** @param array<string, list<string>> $fields */
    private function error(string $code, string $message, int $status, array $fields = []): Response
    {
        $error = ['code' => $code, 'message' => $message];
        if ($fields !== []) $error['fields'] = $fields;
        return Response::json(['error' => $error], $status);
    }

    private function privateError(string $code, string $message, int $status): Response
    {
        return $this->privateJson(['error' => ['code' => $code, 'message' => $message]], $status);
    }

    private function privateJson(array $data, int $status = 200): Response
    {
        return Response::json($data, $status)->withHeader('Cache-Control', 'private, no-store, max-age=0')
            ->withHeader('Pragma', 'no-cache')->withHeader('X-Content-Type-Options', 'nosniff');
    }
}

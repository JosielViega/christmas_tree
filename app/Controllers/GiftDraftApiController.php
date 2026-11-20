<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Csrf;
use App\Core\Request;
use App\Core\Response;
use App\Domain\GiftDraftValidationException;
use App\Domain\IdempotencyConflict;
use App\Services\ChristmasTreeGiftService;
use App\Services\GiftDraftAccessSession;
use App\Services\RateLimiter;

final class GiftDraftApiController
{
    public function __construct(
        private readonly Request $request,
        private readonly Csrf $csrf,
        private readonly ChristmasTreeGiftService $gifts,
        private readonly GiftDraftAccessSession $accessSession,
        private readonly RateLimiter $creationLimiter,
        private readonly int $maxRequestBytes,
    ) {
    }

    public function store(string $treePublicId): Response
    {
        if ($response = $this->validateMutableRequest()) {
            return $response;
        }
        if (!$this->creationLimiter->consume('gift-draft:' . $this->request->ipAddress())) {
            return $this->error('rate_limit_exceeded', 'Muitos presentes foram preparados recentemente. Tente novamente mais tarde.', 429);
        }
        try {
            $creation = $this->gifts->create(
                $treePublicId,
                $this->stringInput('sender_name'),
                $this->stringInput('gift_style'),
                $this->stringInput('composition_mode'),
                $this->stringInput('message'),
                is_string($this->request->header('Idempotency-Key')) ? $this->request->header('Idempotency-Key') : '',
                $this->stringInput('publication_consent') === 'accepted',
                $this->request->file('texture') ?? [],
            );
        } catch (GiftDraftValidationException $exception) {
            return $this->error('validation_failed', 'Revise os dados do presente.', 422, $exception->errors);
        } catch (IdempotencyConflict) {
            return $this->error('idempotency_conflict', 'Esta chave de envio já foi utilizada com dados diferentes.', 409);
        }
        if ($creation === null) {
            return $this->error('tree_not_found', 'Árvore não encontrada.', 404);
        }

        $accessToken = $creation->accessToken ?? $this->accessSession->tokenFor($creation->gift->publicId);
        if ($creation->accessToken !== null) {
            $this->accessSession->grant($creation->gift->publicId, $creation->accessToken);
        }
        $data = ['gift' => $creation->gift->toPrivateArray(), 'created' => $creation->created];
        if ($accessToken !== null) {
            $data['access_token'] = $accessToken;
        }
        return $this->privateJson(['data' => $data], $creation->created ? 201 : 200);
    }

    public function show(string $giftPublicId): Response
    {
        $gift = $this->gifts->findAuthorized($giftPublicId, $this->accessToken($giftPublicId));
        return $gift === null
            ? $this->privateError('gift_draft_not_found', 'Rascunho não encontrado ou acesso inválido.', 404)
            : $this->privateJson(['data' => ['gift' => $gift->toPrivateArray()]]);
    }

    public function destroy(string $giftPublicId): Response
    {
        if ($response = $this->validateMutableRequest()) {
            return $response;
        }
        $gift = $this->gifts->cancel($giftPublicId, $this->accessToken($giftPublicId));
        return $gift === null
            ? $this->privateError('gift_draft_not_found', 'Rascunho não encontrado ou acesso inválido.', 404)
            : $this->privateJson(['data' => ['gift' => $gift->toPrivateArray()]]);
    }

    private function validateMutableRequest(): ?Response
    {
        if ($this->request->contentLength() > $this->maxRequestBytes) {
            return $this->error('payload_too_large', 'A textura excede o tamanho permitido.', 413);
        }
        if (!$this->csrf->verify($this->request->header('X-CSRF-Token', $this->request->input('_token')))) {
            return $this->error('csrf_failed', 'A sessão expirou. Recarregue a página e tente novamente.', 419);
        }
        return null;
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
        if ($fields !== []) {
            $error['fields'] = $fields;
        }
        return Response::json(['error' => $error], $status);
    }

    /** @param array<string, mixed> $data */
    private function privateJson(array $data, int $status = 200): Response
    {
        return Response::json($data, $status)
            ->withHeader('Cache-Control', 'private, no-store, max-age=0')
            ->withHeader('Pragma', 'no-cache')
            ->withHeader('X-Content-Type-Options', 'nosniff');
    }

    private function privateError(string $code, string $message, int $status): Response
    {
        return $this->privateJson(['error' => ['code' => $code, 'message' => $message]], $status);
    }
}

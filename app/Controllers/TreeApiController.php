<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Csrf;
use App\Core\Request;
use App\Core\Response;
use App\Domain\TreeValidationException;
use App\Services\ChristmasTreeIdentityService;
use App\Services\RateLimiter;
use App\Services\TreeOwnerSession;

final class TreeApiController
{
    private const MAX_REQUEST_BYTES = 4096;

    public function __construct(
        private readonly Request $request,
        private readonly Csrf $csrf,
        private readonly ChristmasTreeIdentityService $trees,
        private readonly TreeOwnerSession $ownerSession,
        private readonly RateLimiter $creationLimiter,
        private readonly RateLimiter $recoveryLimiter,
        private readonly array $appConfig,
    ) {
    }

    public function context(): Response
    {
        return $this->success(['csrf_token' => $this->csrf->token()]);
    }

    public function create(): Response
    {
        if ($response = $this->validateMutableRequest()) {
            return $response;
        }

        if (!$this->creationLimiter->consume('create:' . $this->request->ipAddress())) {
            return $this->error('rate_limit_exceeded', 'Muitas árvores foram criadas recentemente. Tente novamente mais tarde.', 429);
        }

        $ownerName = $this->request->input('owner_name');
        try {
            $creation = $this->trees->create(is_string($ownerName) ? $ownerName : '');
        } catch (TreeValidationException $exception) {
            return $this->error('validation_failed', 'Revise os dados informados.', 422, $exception->errors);
        }

        $this->ownerSession->grant($creation->tree->publicId, $creation->adminToken);

        return $this->success([
            'tree' => $creation->tree->toPublicArray(),
            'is_owner' => true,
            'public_path' => '/t/' . $creation->tree->publicId,
            'public_url' => rtrim((string) $this->appConfig['url'], '/') . '/t/' . $creation->tree->publicId,
            'recovery_code' => $creation->recoveryCode,
        ], 201);
    }

    public function show(string $publicId): Response
    {
        $tree = $this->trees->findPublic($publicId);
        if ($tree === null) {
            return $this->error('tree_not_found', 'Árvore não encontrada.', 404);
        }

        return $this->success(['tree' => $tree->toPublicArray()]);
    }

    public function admin(string $publicId): Response
    {
        $tree = $this->trees->findPublic($publicId);
        $token = $this->ownerSession->tokenFor($publicId);

        if ($tree === null || !$this->trees->ownerIsAuthorized($publicId, $token)) {
            return $this->error('owner_access_denied', 'Acesso administrativo não autorizado.', 403);
        }

        return $this->success([
            'tree' => $tree->toPublicArray(),
            'is_owner' => true,
        ]);
    }

    public function recover(string $publicId): Response
    {
        if ($response = $this->validateMutableRequest()) {
            return $response;
        }

        if (!$this->recoveryLimiter->consume('recover:' . $this->request->ipAddress())) {
            return $this->error('rate_limit_exceeded', 'Muitas tentativas de recuperação. Tente novamente mais tarde.', 429);
        }

        $submitted = $this->request->input('recovery_code');
        $recovery = $this->trees->recover($publicId, is_string($submitted) ? trim($submitted) : '');
        if ($recovery === null) {
            return $this->error('invalid_recovery_code', 'Identificador ou código de recuperação inválido.', 401);
        }

        $this->ownerSession->grant($publicId, $recovery->adminToken);

        return $this->success([
            'tree' => $recovery->tree->toPublicArray(),
            'is_owner' => true,
            'public_path' => '/t/' . $recovery->tree->publicId,
            'public_url' => rtrim((string) $this->appConfig['url'], '/') . '/t/' . $recovery->tree->publicId,
            'recovery_code' => $recovery->recoveryCode,
        ]);
    }

    private function validateMutableRequest(): ?Response
    {
        if ($this->request->contentLength() > self::MAX_REQUEST_BYTES) {
            return $this->error('payload_too_large', 'A requisição excede o tamanho permitido.', 413);
        }

        $token = $this->request->header('X-CSRF-Token', $this->request->input('_token'));
        if (!$this->csrf->verify($token)) {
            return $this->error('csrf_failed', 'A sessão expirou. Recarregue a página e tente novamente.', 419);
        }

        return null;
    }

    /** @param array<string, mixed> $data */
    private function success(array $data, int $status = 200): Response
    {
        return Response::json(['data' => $data], $status);
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
}

<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Csrf;
use App\Core\Request;
use App\Core\Response;
use App\Domain\OrnamentCapacityReached;
use App\Domain\OrnamentValidationException;
use App\Services\ChristmasTreeIdentityService;
use App\Services\ChristmasTreeOrnamentService;
use App\Services\OrnamentLayout;
use App\Services\RateLimiter;
use App\Services\TreeOwnerSession;

final class TreeOrnamentApiController
{
    private const MAX_REQUEST_BYTES = 4096;

    public function __construct(
        private readonly Request $request,
        private readonly Csrf $csrf,
        private readonly ChristmasTreeIdentityService $trees,
        private readonly ChristmasTreeOrnamentService $ornaments,
        private readonly TreeOwnerSession $ownerSession,
        private readonly RateLimiter $creationLimiter,
    ) {
    }

    public function index(string $treePublicId): Response
    {
        $ornaments = $this->ornaments->list($treePublicId);
        if ($ornaments === null) {
            return $this->error('tree_not_found', 'Árvore não encontrada.', 404);
        }

        return $this->success([
            'ornaments' => array_map(static fn ($ornament): array => $ornament->toPublicArray(), $ornaments),
            'layout_version' => OrnamentLayout::VERSION,
            'capacity' => $this->ornaments->capacity(),
            'remaining' => max(0, $this->ornaments->capacity() - count($ornaments)),
        ]);
    }

    public function store(string $treePublicId): Response
    {
        if ($response = $this->validateMutableRequest()) {
            return $response;
        }
        if (!$this->creationLimiter->consume('ornament:' . $this->request->ipAddress())) {
            return $this->error('rate_limit_exceeded', 'Muitos enfeites foram enviados recentemente. Tente novamente mais tarde.', 429);
        }

        try {
            $creation = $this->ornaments->create(
                $treePublicId,
                is_string($this->request->input('ornament_type')) ? $this->request->input('ornament_type') : '',
                is_string($this->request->input('sender_name')) ? $this->request->input('sender_name') : '',
                is_string($this->request->header('Idempotency-Key')) ? $this->request->header('Idempotency-Key') : '',
            );
        } catch (OrnamentValidationException $exception) {
            return $this->error('validation_failed', 'Revise os dados do enfeite.', 422, $exception->errors);
        } catch (OrnamentCapacityReached) {
            return $this->error('tree_full', 'Esta árvore já recebeu o máximo de enfeites permitido.', 409);
        }

        if ($creation === null) {
            return $this->error('tree_not_found', 'Árvore não encontrada.', 404);
        }

        return $this->success([
            'ornament' => $creation->ornament->toPublicArray(),
            'created' => $creation->created,
            'capacity' => $this->ornaments->capacity(),
        ], $creation->created ? 201 : 200);
    }

    public function destroy(string $treePublicId, string $ornamentPublicId): Response
    {
        if ($response = $this->validateMutableRequest()) {
            return $response;
        }

        $tree = $this->trees->findPublic($treePublicId);
        if ($tree === null) {
            return $this->error('tree_not_found', 'Árvore não encontrada.', 404);
        }
        if (!$this->trees->ownerIsAuthorized($treePublicId, $this->ownerSession->tokenFor($treePublicId))) {
            return $this->error('owner_access_denied', 'Apenas o responsável pode remover enfeites.', 403);
        }

        if ($this->ornaments->delete($treePublicId, $ornamentPublicId) !== true) {
            return $this->error('ornament_not_found', 'Enfeite não encontrado nesta árvore.', 404);
        }

        return $this->success(['deleted' => true, 'ornament_public_id' => $ornamentPublicId]);
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

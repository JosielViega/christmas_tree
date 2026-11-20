<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Csrf;
use App\Core\Request;
use App\Core\Response;
use App\Domain\MemoryCapacityReached;
use App\Domain\MemoryValidationException;
use App\Services\ChristmasTreeIdentityService;
use App\Services\ChristmasTreeMemoryService;
use App\Services\RateLimiter;
use App\Services\TreeOwnerSession;
use RuntimeException;

final class TreeMemoryApiController
{
    public function __construct(
        private readonly Request $request,
        private readonly Csrf $csrf,
        private readonly ChristmasTreeIdentityService $trees,
        private readonly ChristmasTreeMemoryService $memories,
        private readonly TreeOwnerSession $ownerSession,
        private readonly RateLimiter $mutationLimiter,
        private readonly int $maxRequestBytes,
        private readonly int $capacity = 6,
    ) {
    }

    public function index(string $treePublicId): Response
    {
        $memories = $this->memories->list($treePublicId);
        if ($memories === null) return $this->error('tree_not_found', 'Árvore não encontrada.', 404);
        return Response::json(['data' => [
            'memories' => array_map(static fn ($memory) => $memory->toPublicArray($treePublicId), $memories),
            'layout_version' => 1, 'capacity' => $this->capacity, 'remaining' => max(0, $this->capacity - count($memories)),
        ]])->withHeader('Cache-Control', 'public, max-age=60');
    }

    public function store(string $treePublicId): Response
    {
        if ($response = $this->authorizeMutation($treePublicId)) return $response;
        try {
            $memory = $this->memories->create(
                $treePublicId, $this->stringInput('caption'), $this->request->file('image') ?? [],
            );
        } catch (MemoryValidationException $exception) {
            return $this->error('validation_failed', 'Revise a fotografia enviada.', 422, $exception->errors);
        } catch (MemoryCapacityReached) {
            return $this->error('memory_capacity_reached', 'Você já adicionou as seis memórias disponíveis.', 409);
        }
        return $memory === null
            ? $this->error('tree_not_found', 'Árvore não encontrada.', 404)
            : Response::json(['data' => ['memory' => $memory->toPublicArray($treePublicId), 'capacity' => $this->capacity]], 201);
    }

    public function update(string $treePublicId, string $memoryPublicId): Response
    {
        if ($response = $this->authorizeMutation($treePublicId)) return $response;
        try {
            $memory = $this->memories->update(
                $treePublicId, $memoryPublicId, $this->stringInput('caption'), $this->request->file('image'),
            );
        } catch (MemoryValidationException $exception) {
            return $this->error('validation_failed', 'Revise a memória.', 422, $exception->errors);
        }
        return $memory === null
            ? $this->error('memory_not_found', 'Memória não encontrada.', 404)
            : Response::json(['data' => ['memory' => $memory->toPublicArray($treePublicId), 'capacity' => $this->capacity]]);
    }

    public function destroy(string $treePublicId, string $memoryPublicId): Response
    {
        if ($response = $this->authorizeMutation($treePublicId)) return $response;
        return $this->memories->delete($treePublicId, $memoryPublicId)
            ? Response::json(['data' => ['deleted' => true, 'memory_public_id' => $memoryPublicId]])
            : $this->error('memory_not_found', 'Memória não encontrada.', 404);
    }

    public function image(string $treePublicId, string $memoryPublicId): Response
    {
        try {
            $image = $this->memories->image($treePublicId, $memoryPublicId);
        } catch (RuntimeException) {
            $image = null;
        }
        if ($image === null) return $this->error('memory_image_not_found', 'Imagem não encontrada.', 404);
        $body = file_get_contents($image['path']);
        if (!is_string($body)) return $this->error('memory_image_not_found', 'Imagem não encontrada.', 404);
        return (new Response($body, 200, [
            'Content-Type' => 'image/jpeg',
            'Content-Length' => (string) $image['size'],
            'Cache-Control' => 'public, max-age=86400',
            'ETag' => '"' . $image['sha256'] . '"',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Disposition' => 'inline; filename="memory.jpg"',
        ]));
    }

    private function authorizeMutation(string $treePublicId): ?Response
    {
        if ($this->request->contentLength() > $this->maxRequestBytes) {
            return $this->error('payload_too_large', 'A fotografia excede o tamanho permitido.', 413);
        }
        if (!$this->csrf->verify($this->request->header('X-CSRF-Token', $this->request->input('_token')))) {
            return $this->error('csrf_failed', 'A sessão expirou. Recarregue a página e tente novamente.', 419);
        }
        $tree = $this->trees->findPublic($treePublicId);
        if ($tree === null) return $this->error('tree_not_found', 'Árvore não encontrada.', 404);
        if (!$this->ownerSession->isAuthorized($treePublicId, $this->trees)) {
            return $this->error('owner_access_denied', 'Apenas o proprietário pode alterar as memórias.', 403);
        }
        if (!$this->mutationLimiter->consume('memory:' . $this->request->ipAddress())) {
            return $this->error('rate_limit_exceeded', 'Muitas alterações foram feitas recentemente. Tente novamente mais tarde.', 429);
        }
        return null;
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
}

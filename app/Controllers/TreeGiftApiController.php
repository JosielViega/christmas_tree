<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Csrf;
use App\Core\Request;
use App\Core\Response;
use App\Services\ChristmasTreeIdentityService;
use App\Services\GiftPublicationService;
use App\Services\TreeOwnerSession;

final class TreeGiftApiController
{
    public function __construct(
        private readonly Request $request,
        private readonly Csrf $csrf,
        private readonly GiftPublicationService $gifts,
        private readonly ChristmasTreeIdentityService $trees,
        private readonly TreeOwnerSession $ownerSession,
    ) {
    }

    public function index(string $treePublicId): Response
    {
        $gifts = $this->gifts->forTree($treePublicId);
        if ($gifts === null) return $this->error('tree_not_found', 'Árvore não encontrada.', 404);
        return Response::json(['data' => [
            'gifts' => array_map(static fn ($gift): array => $gift->toPublicArray('/api/gifts/' . rawurlencode($gift->publicId) . '/texture'), $gifts),
            'layout_version' => GiftPublicationService::LAYOUT_VERSION,
            'visible_limit' => GiftPublicationService::VISIBLE_LIMIT,
            'total' => count($gifts),
        ]])->withHeader('Cache-Control', 'public, max-age=30, must-revalidate');
    }

    public function texture(string $giftPublicId): Response
    {
        $texture = $this->gifts->publicTexture($giftPublicId);
        if ($texture === null) return $this->error('gift_texture_not_found', 'Textura não encontrada.', 404);
        $body = file_get_contents($texture['path']);
        if (!is_string($body)) return $this->error('gift_texture_unavailable', 'Textura indisponível.', 503);
        return (new Response($body, 200, [
            'Content-Type' => 'image/png',
            'Content-Length' => (string) $texture['size'],
            'Cache-Control' => 'public, max-age=300, must-revalidate',
            'ETag' => '"' . $texture['sha256'] . '"',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
        ]));
    }

    public function hide(string $treePublicId, string $giftPublicId): Response
    {
        if (!$this->csrf->verify($this->request->header('X-CSRF-Token'))) return $this->error('csrf_failed', 'A sessão expirou.', 419);
        if (!$this->trees->ownerIsAuthorized($treePublicId, $this->ownerSession->tokenFor($treePublicId))) {
            return $this->error('owner_access_denied', 'Apenas o responsável pode ocultar presentes.', 403);
        }
        $hidden = $this->gifts->hide($treePublicId, $giftPublicId);
        if ($hidden !== true) return $this->error('gift_not_found', 'Presente publicado não encontrado.', 404);
        return Response::json(['data' => ['hidden' => true, 'gift_public_id' => $giftPublicId]]);
    }

    public function message(string $treePublicId, string $giftPublicId): Response
    {
        if (!$this->trees->ownerIsAuthorized($treePublicId, $this->ownerSession->tokenFor($treePublicId))) {
            return $this->privateError('owner_access_denied', 'Acesso administrativo não autorizado.', 403);
        }
        $message = $this->gifts->ownerMessage($treePublicId, $giftPublicId);
        if ($message === null) return $this->privateError('gift_message_locked', 'A mensagem estará disponível em 25 de dezembro.', 423);
        return $this->privateJson(['data' => $message]);
    }

    private function error(string $code, string $message, int $status): Response
    {
        return Response::json(['error' => ['code' => $code, 'message' => $message]], $status);
    }

    private function privateError(string $code, string $message, int $status): Response
    {
        return $this->privateJson(['error' => ['code' => $code, 'message' => $message]], $status);
    }

    private function privateJson(array $payload, int $status = 200): Response
    {
        return Response::json($payload, $status)->withHeader('Cache-Control', 'private, no-store, max-age=0')
            ->withHeader('Pragma', 'no-cache')->withHeader('X-Content-Type-Options', 'nosniff');
    }
}

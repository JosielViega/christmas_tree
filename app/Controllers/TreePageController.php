<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Csrf;
use App\Core\FrontendAssets;
use App\Core\Response;
use App\Core\View;
use App\Services\ChristmasTreeIdentityService;
use App\Services\PersistentTreeAccessService;
use App\Services\TreeOwnerSession;

final class TreePageController
{
    public function __construct(
        private readonly View $view,
        private readonly FrontendAssets $frontendAssets,
        private readonly Csrf $csrf,
        private readonly ChristmasTreeIdentityService $trees,
        private readonly TreeOwnerSession $ownerSession,
        private readonly array $appConfig,
        private readonly PersistentTreeAccessService $persistentAccess,
    ) {
    }

    public function show(string $publicId): Response
    {
        $tree = $this->trees->findPublic($publicId);
        if ($tree === null) {
            return Response::html($this->view->render('pages/tree-not-found', [
                'title' => 'Árvore não encontrada',
            ]), 404);
        }

        $isOwner = $this->ownerSession->isAuthorized($publicId, $this->trees);
        $primaryPublicId = $this->ownerSession->primaryPublicId();
        $primaryTree = is_string($primaryPublicId) ? $this->trees->findPublic($primaryPublicId) : null;
        $bootstrap = [
            'csrf_token' => $this->csrf->token(),
            'tree' => $tree->toPublicArray(),
            'is_owner' => $isOwner,
            'public_url' => public_tree_url((string) $this->appConfig['url'], $tree->publicId),
            'has_own_tree' => $primaryTree !== null,
            'own_tree_path' => $primaryTree !== null ? '/t/' . $primaryTree->publicId : null,
        ];

        $title = '🎄 Árvore de Natal de ' . $tree->ownerName;
        $description = 'Decore esta árvore e deixe uma mensagem secreta para ' . $tree->ownerName . ' abrir no Natal!';
        $canonicalUrl = (string) $bootstrap['public_url'];

        $response = Response::html($this->view->render('pages/home', [
            'title' => $title,
            'frontend' => $this->frontendAssets->entry('index.html'),
            'frontendBootstrap' => self::encodeBootstrap($bootstrap),
            'meta' => [
                'title' => $title,
                'description' => $description,
                'canonical_url' => $canonicalUrl,
                'image_url' => public_app_url((string) $this->appConfig['url'], '/assets/images/christmas-tree-social.jpg'),
            ],
        ], 'layouts/christmas-tree'));
        return $this->persistentAccess->shouldClearCookie()
            ? $response->withHeader('Set-Cookie', $this->persistentAccess->clearCookieHeader())
            : $response;
    }

    /** @param array<string, mixed> $bootstrap */
    public static function encodeBootstrap(array $bootstrap): string
    {
        return json_encode(
            $bootstrap,
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
                | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT,
        );
    }
}

<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Csrf;
use App\Core\FrontendAssets;
use App\Core\Response;
use App\Core\View;
use App\Services\ChristmasTreeIdentityService;
use App\Services\TreeOwnerSession;

final class TreePageController
{
    public function __construct(
        private readonly View $view,
        private readonly FrontendAssets $frontendAssets,
        private readonly Csrf $csrf,
        private readonly ChristmasTreeIdentityService $trees,
        private readonly TreeOwnerSession $ownerSession,
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

        $isOwner = $this->trees->ownerIsAuthorized($publicId, $this->ownerSession->tokenFor($publicId));
        $bootstrap = [
            'csrf_token' => $this->csrf->token(),
            'tree' => $tree->toPublicArray(),
            'is_owner' => $isOwner,
        ];

        return Response::html($this->view->render('pages/home', [
            'title' => 'Árvore de Natal de ' . $tree->ownerName,
            'frontend' => $this->frontendAssets->entry('index.html'),
            'frontendBootstrap' => self::encodeBootstrap($bootstrap),
        ], 'layouts/christmas-tree'));
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

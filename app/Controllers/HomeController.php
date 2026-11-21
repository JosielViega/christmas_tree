<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Csrf;
use App\Core\FrontendAssets;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Core\View;
use App\Validation\Validator;
use App\Services\ChristmasTreeIdentityService;
use App\Services\PersistentTreeAccessService;
use App\Services\TreeOwnerSession;

final class HomeController
{
    public function __construct(
        private readonly Request $request,
        private readonly View $view,
        private readonly Session $session,
        private readonly Csrf $csrf,
        private readonly Validator $validator,
        private readonly array $appConfig,
        private readonly FrontendAssets $frontendAssets,
        private readonly ChristmasTreeIdentityService $trees,
        private readonly TreeOwnerSession $ownerSession,
        private readonly PersistentTreeAccessService $persistentAccess,
    ) {
    }

    public function index(): Response
    {
        $primary = $this->ownerSession->primaryPublicId();
        if (is_string($primary) && $this->trees->findPublic($primary) !== null) {
            return Response::redirect('/t/' . $primary, 302)
                ->withHeader('Cache-Control', 'private, no-store, max-age=0');
        }
        $bootstrap = TreePageController::encodeBootstrap([
            'csrf_token' => $this->csrf->token(),
            'tree' => null,
            'is_owner' => false,
            'public_path' => null,
            'public_url' => null,
            'has_own_tree' => false,
            'own_tree_path' => null,
        ]);

        $title = 'Christmas Tree — Crie sua árvore de Natal 3D';
        $response = Response::html($this->view->render('pages/home', [
            'title' => $title,
            'appName' => $this->appConfig['name'],
            'csrfField' => $this->csrf->field(),
            'flashes' => $this->session->consumeFlash(),
            'frontend' => $this->frontendAssets->entry('index.html'),
            'frontendBootstrap' => $bootstrap,
            'meta' => [
                'title' => $title,
                'description' => 'Crie sua árvore de Natal 3D, convide amigos para decorar e receba mensagens secretas para abrir no Natal.',
                'canonical_url' => public_app_url((string) $this->appConfig['url']),
                'image_url' => public_app_url((string) $this->appConfig['url'], '/assets/images/christmas-tree-social.jpg'),
            ],
        ], 'layouts/christmas-tree'));
        return $this->persistentAccess->shouldClearCookie()
            ? $response->withHeader('Set-Cookie', $this->persistentAccess->clearCookieHeader())
            : $response;
    }

    public function credits(): Response
    {
        return Response::html($this->view->render('pages/credits', [
            'title' => 'Créditos open-source',
        ]));
    }

    public function submitExample(): Response
    {
        if (!$this->csrf->verify($this->request->input('_token'))) {
            return Response::html($this->view->render('pages/error', [
                'title' => 'Invalid request',
                'heading' => 'Invalid or expired form',
                'message' => 'Reload the page and try again.',
            ]), 419);
        }

        $data = ['message' => $this->request->input('message')];
        if (!$this->validator->validate($data, ['message' => 'required|string|min:2|max:120'])) {
            foreach ($this->validator->errors()['message'] ?? [] as $error) {
                $this->session->flash('error', $error);
            }

            return Response::redirect('/');
        }

        $this->session->flash('success', 'The demonstration form was processed safely.');

        return Response::redirect('/');
    }
}

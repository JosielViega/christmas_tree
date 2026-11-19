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
    ) {
    }

    public function index(): Response
    {
        return Response::html($this->view->render('pages/home', [
            'title' => 'Christmas Tree',
            'appName' => $this->appConfig['name'],
            'csrfField' => $this->csrf->field(),
            'flashes' => $this->session->consumeFlash(),
            'frontend' => $this->frontendAssets->entry('index.html'),
        ], 'layouts/christmas-tree'));
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

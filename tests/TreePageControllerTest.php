<?php

declare(strict_types=1);

namespace Tests;

use App\Controllers\TreePageController;
use App\Core\Csrf;
use App\Core\FrontendAssets;
use App\Core\Session;
use App\Core\View;
use App\Services\ChristmasTreeIdentityService;
use App\Services\TreeOwnerSession;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeRepository;

final class TreePageControllerTest extends TestCase
{
    protected function setUp(): void
    {
        $_SESSION = [];
    }

    public function testPublicPageContainsTreeIdentityAndOwnerContextWithoutRawToken(): void
    {
        $session = new Session(false);
        $ownerSession = new TreeOwnerSession($session);
        $service = new ChristmasTreeIdentityService(new InMemoryChristmasTreeRepository());
        $creation = $service->create('Maria <Natal>');
        $ownerSession->grant($creation->tree->publicId, $creation->adminToken);

        $response = $this->controller($service, $ownerSession, new Csrf($session))->show($creation->tree->publicId);

        self::assertSame(200, $response->status());
        self::assertStringContainsString('Maria &lt;Natal&gt;', $response->body());
        self::assertStringContainsString('"is_owner":true', $response->body());
        self::assertStringNotContainsString($creation->adminToken, $response->body());
        self::assertStringNotContainsString($creation->recoveryCode, $response->body());
    }

    public function testUnknownTreeRendersAReal404(): void
    {
        $session = new Session(false);
        $service = new ChristmasTreeIdentityService(new InMemoryChristmasTreeRepository());
        $response = $this->controller($service, new TreeOwnerSession($session), new Csrf($session))
            ->show('AbCdEf1234_-');

        self::assertSame(404, $response->status());
        self::assertStringContainsString('Árvore não encontrada', $response->body());
    }

    private function controller(
        ChristmasTreeIdentityService $service,
        TreeOwnerSession $ownerSession,
        Csrf $csrf,
    ): TreePageController {
        return new TreePageController(
            new View(dirname(__DIR__) . '/resources/views'),
            new FrontendAssets(dirname(__DIR__) . '/public/assets/app/.vite/manifest.json'),
            $csrf,
            $service,
            $ownerSession,
        );
    }
}

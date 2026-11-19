<?php

declare(strict_types=1);

namespace Tests;

use App\Controllers\TreePageController;
use App\Core\Csrf;
use App\Core\FrontendAssets;
use App\Core\Session;
use App\Core\View;
use App\Services\ChristmasTreeIdentityService;
use App\Services\ChristmasTreeOrnamentService;
use App\Services\TreeOwnerSession;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeOrnamentRepository;
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
        self::assertStringContainsString('property="og:title" content="🎄 Árvore de Natal de Maria &lt;Natal&gt;"', $response->body());
        self::assertStringContainsString('rel="canonical" href="https://christmas.test/t/' . $creation->tree->publicId . '"', $response->body());
        self::assertStringContainsString('property="og:image" content="https://christmas.test/assets/images/christmas-tree-social.jpg"', $response->body());
        self::assertStringNotContainsString('admin:private', $response->body());
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

    public function testInitialHtmlAndMetadataNeverContainOrnamentMessage(): void
    {
        $session = new Session(false);
        $treeRepository = new InMemoryChristmasTreeRepository();
        $service = new ChristmasTreeIdentityService($treeRepository);
        $creation = $service->create('Árvore privada');
        $secret = 'Mensagem que não pode entrar no HTML 🎁';
        $ornaments = new ChristmasTreeOrnamentService($treeRepository, new InMemoryChristmasTreeOrnamentRepository());
        $ornaments->create($creation->tree->publicId, 'present', 'Visitante', str_repeat('p', 16), $secret);

        $response = $this->controller($service, new TreeOwnerSession($session), new Csrf($session))
            ->show($creation->tree->publicId);

        self::assertSame(200, $response->status());
        self::assertStringNotContainsString($secret, $response->body());
        self::assertStringNotContainsString('Mensagem que não pode entrar', $response->body());
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
            ['url' => 'https://admin:private@christmas.test'],
        );
    }
}

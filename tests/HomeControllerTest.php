<?php

declare(strict_types=1);

namespace Tests;

use App\Controllers\HomeController;
use App\Core\Csrf;
use App\Core\FrontendAssets;
use App\Core\Request;
use App\Core\Session;
use App\Core\View;
use App\Services\ChristmasTreeIdentityService;
use App\Services\PersistentTreeAccessService;
use App\Services\TreeOwnerSession;
use App\Validation\Validator;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeRepository;
use Tests\Support\InMemoryPersistentTreeCredentialRepository;

final class HomeControllerTest extends TestCase
{
    protected function setUp(): void
    {
        $_SESSION = [];
    }

    public function testRecognizedOwnerIsRedirectedToPrimaryTreeWithoutLoopingPublicPage(): void
    {
        $session = new Session(false);
        $ownerSession = new TreeOwnerSession($session);
        $trees = new ChristmasTreeIdentityService(new InMemoryChristmasTreeRepository());
        $created = $trees->create('Navegador reconhecido');
        $ownerSession->grant($created->tree->publicId, $created->adminToken);

        $response = $this->controller($session, $ownerSession, $trees)->index();

        self::assertSame(302, $response->status());
        self::assertSame('/t/' . $created->tree->publicId, $response->headers()['Location'] ?? null);
        self::assertSame('private, no-store, max-age=0', $response->headers()['Cache-Control'] ?? null);
    }

    public function testUnrecognizedBrowserReceivesCreationExperience(): void
    {
        $session = new Session(false);
        $ownerSession = new TreeOwnerSession($session);
        $trees = new ChristmasTreeIdentityService(new InMemoryChristmasTreeRepository());

        $response = $this->controller($session, $ownerSession, $trees)->index();

        self::assertSame(200, $response->status());
        self::assertStringContainsString('"tree":null', $response->body());
        self::assertStringContainsString('"has_own_tree":false', $response->body());
    }

    public function testInvalidPersistentCookieIsClearedWithoutGrantingAccess(): void
    {
        $session = new Session(false);
        $ownerSession = new TreeOwnerSession($session);
        $trees = new ChristmasTreeIdentityService(new InMemoryChristmasTreeRepository());
        $persistent = new PersistentTreeAccessService(
            new InMemoryPersistentTreeCredentialRepository(),
            $ownerSession,
            'tree_access',
        );
        self::assertNull($persistent->restore('invalid-cookie'));

        $response = $this->controller($session, $ownerSession, $trees, $persistent)->index();

        self::assertSame(200, $response->status());
        self::assertStringContainsString('tree_access=; Max-Age=0', $response->headers()['Set-Cookie'] ?? '');
    }

    private function controller(
        Session $session,
        TreeOwnerSession $ownerSession,
        ChristmasTreeIdentityService $trees,
        ?PersistentTreeAccessService $persistentAccess = null,
    ): HomeController {
        return new HomeController(
            new Request(),
            new View(dirname(__DIR__) . '/resources/views'),
            $session,
            new Csrf($session),
            new Validator(),
            ['name' => 'Christmas Tree', 'url' => 'https://christmas.test'],
            new FrontendAssets(dirname(__DIR__) . '/public/assets/app/.vite/manifest.json'),
            $trees,
            $ownerSession,
            $persistentAccess ?? new PersistentTreeAccessService(
                new InMemoryPersistentTreeCredentialRepository(),
                $ownerSession,
                'tree_access',
            ),
        );
    }
}

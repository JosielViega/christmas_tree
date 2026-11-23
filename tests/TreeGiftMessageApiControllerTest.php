<?php

declare(strict_types=1);

namespace Tests;

use App\Controllers\TreeGiftApiController;
use App\Core\Csrf;
use App\Core\Request;
use App\Core\Session;
use App\Services\ChristmasTreeIdentityService;
use App\Services\GiftPublicationService;
use App\Services\GiftTextureStorage;
use App\Services\MessageReleasePolicy;
use App\Services\PersistentTreeAccessService;
use App\Services\TreeOwnerSession;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeGiftRepository;
use Tests\Support\InMemoryChristmasTreeRepository;
use Tests\Support\InMemoryGiftPublicationRepository;
use Tests\Support\InMemoryPersistentTreeCredentialRepository;

final class TreeGiftMessageApiControllerTest extends TestCase
{
    public function testManualReleaseStillRequiresMatchingOwnerAndSupportsPersistentCookie(): void
    {
        $_SESSION = [];
        $repository = new InMemoryChristmasTreeRepository();
        $trees = new ChristmasTreeIdentityService($repository);
        $first = $trees->create('Primeira');
        $second = $trees->create('Segunda');
        $giftId = str_repeat('p', 16);
        $publications = new InMemoryGiftPublicationRepository();
        $publications->messages[$giftId] = ['tree_id' => $first->tree->id, 'message' => 'Conteúdo premium privado'];
        $released = $this->giftService($repository, $publications, true);

        $visitorOwner = new TreeOwnerSession(new Session(false));
        self::assertSame(403, $this->controller($released, $trees, $visitorOwner)->message($first->tree->publicId, $giftId)->status());

        $visitorOwner->grant($second->tree->publicId, $second->adminToken);
        self::assertSame(403, $this->controller($released, $trees, $visitorOwner)->message($first->tree->publicId, $giftId)->status());

        $_SESSION = [];
        $credentials = new InMemoryPersistentTreeCredentialRepository();
        $credentials->registerTree($first->tree);
        $clock = static fn (): DateTimeImmutable => new DateTimeImmutable('2026-11-01T00:00:00+00:00');
        $issuerOwner = new TreeOwnerSession(new Session(false));
        $cookie = (new PersistentTreeAccessService($credentials, $issuerOwner, 'tree_access', 90, true, $clock))->issue($first->tree);
        $_SESSION = [];
        $restoredOwner = new TreeOwnerSession(new Session(false));
        self::assertSame(
            $first->tree->publicId,
            (new PersistentTreeAccessService($credentials, $restoredOwner, 'tree_access', 90, true, $clock))->restore($cookie)?->publicId,
        );
        $response = $this->controller($released, $trees, $restoredOwner)->message($first->tree->publicId, $giftId);
        self::assertSame(200, $response->status());
        $payload = json_decode($response->body(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('Conteúdo premium privado', $payload['data']['message']);
        self::assertSame('private, no-store, max-age=0', $response->headers()['Cache-Control']);

        $locked = $this->controller($this->giftService($repository, $publications, false), $trees, $restoredOwner)
            ->message($first->tree->publicId, $giftId);
        self::assertSame(423, $locked->status());
        self::assertStringNotContainsString('Conteúdo premium privado', $locked->body());
        self::assertSame(0, $publications->mutationCount);
    }

    private function giftService(
        InMemoryChristmasTreeRepository $trees,
        InMemoryGiftPublicationRepository $publications,
        bool $manual,
    ): GiftPublicationService {
        $clock = static fn (): DateTimeImmutable => new DateTimeImmutable('2026-11-01T00:00:00+00:00');
        return new GiftPublicationService(
            $trees,
            new InMemoryChristmasTreeGiftRepository(),
            $publications,
            new GiftTextureStorage(sys_get_temp_dir() . '/gift-message-api-unused'),
            '2026-12-25 00:00:00',
            'America/Sao_Paulo',
            $clock,
            new MessageReleasePolicy('2026-12-25 00:00:00', 'America/Sao_Paulo', $manual, $clock),
        );
    }

    private function controller(
        GiftPublicationService $gifts,
        ChristmasTreeIdentityService $trees,
        TreeOwnerSession $owner,
    ): TreeGiftApiController {
        $session = new Session(false);
        return new TreeGiftApiController(new Request(), new Csrf($session), $gifts, $trees, $owner);
    }
}

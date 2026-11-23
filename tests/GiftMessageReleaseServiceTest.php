<?php

declare(strict_types=1);

namespace Tests;

use App\Services\ChristmasTreeIdentityService;
use App\Services\GiftPublicationService;
use App\Services\GiftTextureStorage;
use App\Services\MessageReleasePolicy;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeGiftRepository;
use Tests\Support\InMemoryChristmasTreeRepository;
use Tests\Support\InMemoryGiftPublicationRepository;

final class GiftMessageReleaseServiceTest extends TestCase
{
    private string $storage;
    private InMemoryChristmasTreeRepository $trees;
    private InMemoryGiftPublicationRepository $publications;

    protected function setUp(): void
    {
        $this->storage = sys_get_temp_dir() . '/gift-message-release-' . bin2hex(random_bytes(5));
        $this->trees = new InMemoryChristmasTreeRepository();
        $this->publications = new InMemoryGiftPublicationRepository();
    }

    public function testPremiumMessageHonorsManualAutomaticAndReversibleReleaseWithoutMutations(): void
    {
        $identity = new ChristmasTreeIdentityService($this->trees);
        $first = $identity->create('Primeira')->tree;
        $second = $identity->create('Segunda')->tree;
        $giftId = str_repeat('g', 16);
        $this->publications->messages[$giftId] = ['tree_id' => $first->id, 'message' => 'Mensagem premium'];

        self::assertNull($this->service('2026-11-01T00:00:00+00:00', false)->ownerMessage($first->publicId, $giftId));
        $manual = $this->service('2026-11-01T00:00:00+00:00', true)->ownerMessage($first->publicId, $giftId);
        self::assertSame('Mensagem premium', $manual['message']);
        self::assertSame('2026-12-25T03:00:00Z', $manual['reveal_at']);
        self::assertNull($this->service('2026-11-01T00:00:00+00:00', false)->ownerMessage($first->publicId, $giftId));
        self::assertSame('Mensagem premium', $this->service('2026-12-25T03:00:00+00:00')->ownerMessage($first->publicId, $giftId)['message']);
        self::assertNull($this->service('2026-11-01T00:00:00+00:00', true)->ownerMessage($second->publicId, $giftId));
        self::assertSame(0, $this->publications->mutationCount);
    }

    private function service(string $instant, bool $manual = false): GiftPublicationService
    {
        $clock = static fn (): DateTimeImmutable => new DateTimeImmutable($instant);
        return new GiftPublicationService(
            $this->trees,
            new InMemoryChristmasTreeGiftRepository(),
            $this->publications,
            new GiftTextureStorage($this->storage),
            '2026-12-25 00:00:00',
            'America/Sao_Paulo',
            $clock,
            new MessageReleasePolicy('2026-12-25 00:00:00', 'America/Sao_Paulo', $manual, $clock),
        );
    }
}

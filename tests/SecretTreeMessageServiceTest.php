<?php

declare(strict_types=1);

namespace Tests;

use App\Domain\IdempotencyConflict;
use App\Domain\OrnamentValidationException;
use App\Services\ChristmasTreeIdentityService;
use App\Services\ChristmasTreeOrnamentService;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeOrnamentRepository;
use Tests\Support\InMemoryChristmasTreeRepository;

final class SecretTreeMessageServiceTest extends TestCase
{
    private InMemoryChristmasTreeRepository $treeRepository;
    private InMemoryChristmasTreeOrnamentRepository $ornamentRepository;
    private ChristmasTreeIdentityService $trees;

    protected function setUp(): void
    {
        $this->treeRepository = new InMemoryChristmasTreeRepository();
        $this->ornamentRepository = new InMemoryChristmasTreeOrnamentRepository();
        $this->trees = new ChristmasTreeIdentityService($this->treeRepository);
    }

    public function testPersistsUnicodeEmojiAndLineBreaksButNeverAddsContentToPublicOrnament(): void
    {
        $tree = $this->trees->create('Clara')->tree;
        $service = $this->serviceAt('2026-12-25T03:00:00+00:00');
        $secret = "Feliz Natal, família! 🎄\r\nCom carinho ❤️";
        $created = $service->create($tree->publicId, 'heart', 'João', str_repeat('a', 16), $secret);

        self::assertTrue($created->ornament->hasMessage);
        self::assertArrayNotHasKey('message', $created->ornament->toPublicArray());
        $overview = $service->messageOverview($tree->publicId);
        self::assertTrue($overview->revealed);
        self::assertSame(1, $overview->messageCount);
        self::assertSame("Feliz Natal, família! 🎄\nCom carinho ❤️", $overview->messages[0]->message);
    }

    public function testRejectsEmptyOversizedAndControlCharacterMessages(): void
    {
        $tree = $this->trees->create('Clara')->tree;
        $service = $this->serviceAt('2026-11-01T00:00:00+00:00');

        foreach ([' ', str_repeat('á', 501), "Olá\x00mundo"] as $index => $message) {
            try {
                $service->create($tree->publicId, 'star', 'Lia', str_repeat((string) ($index + 1), 16), $message);
                self::fail('Invalid message should fail.');
            } catch (OrnamentValidationException $exception) {
                self::assertArrayHasKey('message', $exception->errors);
            }
        }
    }

    public function testIdempotencyAllowsExactRetryAndRejectsPayloadMutation(): void
    {
        $tree = $this->trees->create('Clara')->tree;
        $service = $this->serviceAt('2026-11-01T00:00:00+00:00');
        $key = str_repeat('k', 16);
        $first = $service->create($tree->publicId, 'star', 'Lia', $key, 'Mensagem original');
        $retry = $service->create($tree->publicId, 'star', 'Lia', $key, 'Mensagem original');

        self::assertFalse($retry->created);
        self::assertSame($first->ornament->publicId, $retry->ornament->publicId);
        $this->expectException(IdempotencyConflict::class);
        $service->create($tree->publicId, 'star', 'Lia', $key, 'Mensagem alterada');
    }

    public function testServerClockLocksBeforeAndRevealsAtExactInstantAndAfter(): void
    {
        $tree = $this->trees->create('Clara')->tree;
        $before = $this->serviceAt('2026-12-25T02:59:59+00:00');
        $before->create($tree->publicId, 'star', 'Lia', str_repeat('b', 16), 'Segredo de Natal');

        $locked = $before->messageOverview($tree->publicId);
        self::assertFalse($locked->revealed);
        self::assertSame(1, $locked->messageCount);
        self::assertSame([], $locked->messages);
        self::assertSame('2026-12-25T03:00:00Z', $locked->revealAt);

        $exact = $this->serviceAt('2026-12-25T03:00:00+00:00')->messageOverview($tree->publicId);
        self::assertTrue($exact->revealed);
        self::assertSame('Segredo de Natal', $exact->messages[0]->message);

        $after = $this->serviceAt('2027-01-01T00:00:00+00:00')->messageOverview($tree->publicId);
        self::assertTrue($after->revealed);
    }

    public function testMessagesStayScopedAndLegacyOrnamentsRemainWithoutContent(): void
    {
        $firstTree = $this->trees->create('Primeira')->tree;
        $secondTree = $this->trees->create('Segunda')->tree;
        $this->ornamentRepository->addLegacyOrnament($firstTree->id);
        $service = $this->serviceAt('2027-01-01T00:00:00+00:00');
        $created = $service->create($secondTree->publicId, 'bauble_blue', 'Bia', str_repeat('c', 16), 'Somente segunda árvore');

        $firstOverview = $service->messageOverview($firstTree->publicId);
        self::assertSame(0, $firstOverview->messageCount);
        self::assertSame([], $firstOverview->messages);
        self::assertFalse($service->list($firstTree->publicId)[0]->hasMessage);

        self::assertSame('Somente segunda árvore', $service->messageOverview($secondTree->publicId)->messages[0]->message);
        self::assertTrue($service->delete($secondTree->publicId, $created->ornament->publicId));
        self::assertSame(0, $service->messageOverview($secondTree->publicId)->messageCount);
    }

    private function serviceAt(string $instant): ChristmasTreeOrnamentService
    {
        return new ChristmasTreeOrnamentService(
            $this->treeRepository,
            $this->ornamentRepository,
            60,
            '2026-12-25 00:00:00',
            'America/Sao_Paulo',
            static fn (): DateTimeImmutable => new DateTimeImmutable($instant),
        );
    }
}

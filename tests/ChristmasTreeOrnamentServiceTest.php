<?php

declare(strict_types=1);

namespace Tests;

use App\Domain\OrnamentCapacityReached;
use App\Domain\OrnamentValidationException;
use App\Services\ChristmasTreeIdentityService;
use App\Services\ChristmasTreeOrnamentService;
use App\Services\OrnamentLayout;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeOrnamentRepository;
use Tests\Support\InMemoryChristmasTreeRepository;

final class ChristmasTreeOrnamentServiceTest extends TestCase
{
    private ChristmasTreeIdentityService $trees;
    private ChristmasTreeOrnamentService $ornaments;

    protected function setUp(): void
    {
        $treeRepository = new InMemoryChristmasTreeRepository();
        $this->trees = new ChristmasTreeIdentityService($treeRepository);
        $this->ornaments = new ChristmasTreeOrnamentService($treeRepository, new InMemoryChristmasTreeOrnamentRepository());
    }

    public function testAddsValidOrnamentsWithDistinctStableSlotsAndPersistsThem(): void
    {
        $tree = $this->trees->create('Helena')->tree;
        $first = $this->ornaments->create($tree->publicId, 'bauble_red', ' João  Silva ', str_repeat('a', 16));
        $second = $this->ornaments->create($tree->publicId, 'star', 'Maria', str_repeat('b', 16));

        self::assertNotNull($first);
        self::assertNotNull($second);
        self::assertTrue($first->created);
        self::assertSame('João Silva', $first->ornament->senderName);
        self::assertNotSame($first->ornament->slotIndex, $second->ornament->slotIndex);
        $persistedIds = array_column($this->ornaments->list($tree->publicId), 'publicId');
        sort($persistedIds);
        $expectedIds = [$first->ornament->publicId, $second->ornament->publicId];
        sort($expectedIds);
        self::assertSame($expectedIds, $persistedIds);
    }

    public function testRejectsInvalidTypeAndName(): void
    {
        $tree = $this->trees->create('Helena')->tree;

        try {
            $this->ornaments->create($tree->publicId, 'script', 'x', str_repeat('a', 16));
            self::fail('Validation should fail.');
        } catch (OrnamentValidationException $exception) {
            self::assertArrayHasKey('ornament_type', $exception->errors);
            self::assertArrayHasKey('sender_name', $exception->errors);
        }
    }

    public function testKeepsTreesIndependentAndRejectsMissingTree(): void
    {
        $firstTree = $this->trees->create('Ana')->tree;
        $secondTree = $this->trees->create('Bia')->tree;

        $first = $this->ornaments->create($firstTree->publicId, 'heart', 'Caio', str_repeat('c', 16));
        $second = $this->ornaments->create($secondTree->publicId, 'heart', 'Caio', str_repeat('c', 16));

        self::assertCount(1, $this->ornaments->list($firstTree->publicId));
        self::assertCount(1, $this->ornaments->list($secondTree->publicId));
        self::assertNotSame($first->ornament->publicId, $second->ornament->publicId);
        self::assertNull($this->ornaments->create('AbCdEf1234_-', 'heart', 'Caio', str_repeat('c', 16)));
    }

    public function testIdempotencyReturnsOriginalOrnament(): void
    {
        $tree = $this->trees->create('Lia')->tree;
        $key = str_repeat('d', 16);

        $first = $this->ornaments->create($tree->publicId, 'present', 'Davi', $key);
        $repeated = $this->ornaments->create($tree->publicId, 'present', 'Davi', $key);

        self::assertTrue($first->created);
        self::assertFalse($repeated->created);
        self::assertSame($first->ornament->publicId, $repeated->ornament->publicId);
        self::assertCount(1, $this->ornaments->list($tree->publicId));
    }

    public function testEnforcesCapacityAndLayoutContract(): void
    {
        $tree = $this->trees->create('Nina')->tree;
        for ($index = 0; $index < OrnamentLayout::SLOT_COUNT; $index++) {
            $key = str_pad((string) $index, 16, 'x');
            $this->ornaments->create($tree->publicId, 'bauble_gold', 'Pessoa', $key);
        }

        self::assertCount(60, $this->ornaments->list($tree->publicId));
        $this->expectException(OrnamentCapacityReached::class);
        $this->ornaments->create($tree->publicId, 'bauble_blue', 'Outra', str_repeat('z', 16));
    }

    public function testDeletionIsScopedToTree(): void
    {
        $firstTree = $this->trees->create('Ana')->tree;
        $secondTree = $this->trees->create('Bia')->tree;
        $ornament = $this->ornaments->create($firstTree->publicId, 'star', 'Leo', str_repeat('e', 16))->ornament;

        self::assertFalse($this->ornaments->delete($secondTree->publicId, $ornament->publicId));
        self::assertTrue($this->ornaments->delete($firstTree->publicId, $ornament->publicId));
        self::assertSame([], $this->ornaments->list($firstTree->publicId));
    }
}

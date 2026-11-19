<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Domain\ChristmasTreeOrnament;
use App\Domain\OrnamentCapacityReached;
use App\Domain\OrnamentCreation;
use App\Repositories\ChristmasTreeOrnamentRepository;

final class InMemoryChristmasTreeOrnamentRepository implements ChristmasTreeOrnamentRepository
{
    /** @var array<int, list<array{ornament: ChristmasTreeOrnament, idempotency_key_hash: string}>> */
    private array $records = [];
    private int $nextId = 1;

    public function forTree(int $treeId): array
    {
        $ornaments = array_map(static fn (array $record): ChristmasTreeOrnament => $record['ornament'], $this->records[$treeId] ?? []);
        usort($ornaments, static fn (ChristmasTreeOrnament $a, ChristmasTreeOrnament $b): int => $a->slotIndex <=> $b->slotIndex);

        return $ornaments;
    }

    public function createInAvailableSlot(int $treeId, array $attributes, int $slotCount): OrnamentCreation
    {
        foreach ($this->records[$treeId] ?? [] as $record) {
            if (hash_equals($record['idempotency_key_hash'], $attributes['idempotency_key_hash'])) {
                return new OrnamentCreation($record['ornament'], false);
            }
        }

        $used = array_fill_keys(array_map(
            static fn (array $record): int => $record['ornament']->slotIndex,
            $this->records[$treeId] ?? [],
        ), true);
        if (count($used) >= $slotCount) {
            throw new OrnamentCapacityReached();
        }
        $available = array_values(array_filter(
            range(0, $slotCount - 1),
            static fn (int $slot): bool => !isset($used[$slot]),
        ));
        $selector = (int) hexdec(substr($attributes['idempotency_key_hash'], 0, 7));
        $slot = $available[$selector % count($available)];
        $ornament = new ChristmasTreeOrnament(
            $this->nextId++,
            $treeId,
            $attributes['public_id'],
            $attributes['ornament_type'],
            $attributes['ornament_color'],
            $attributes['sender_name'],
            $slot,
            $attributes['layout_version'],
            $attributes['created_at'],
        );
        $this->records[$treeId][] = ['ornament' => $ornament, 'idempotency_key_hash' => $attributes['idempotency_key_hash']];

        return new OrnamentCreation($ornament, true);
    }

    public function deleteFromTree(int $treeId, string $ornamentPublicId): bool
    {
        foreach ($this->records[$treeId] ?? [] as $index => $record) {
            if ($record['ornament']->publicId === $ornamentPublicId) {
                array_splice($this->records[$treeId], $index, 1);
                return true;
            }
        }

        return false;
    }
}

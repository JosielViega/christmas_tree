<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Domain\ChristmasTreeMemory;
use App\Domain\MemoryCapacityReached;
use App\Repositories\ChristmasTreeMemoryRepository;

final class InMemoryChristmasTreeMemoryRepository implements ChristmasTreeMemoryRepository
{
    /** @var array<string, ChristmasTreeMemory> */
    public array $records = [];
    private int $nextId = 1;

    public function forTree(int $treeId): array
    {
        $items = array_values(array_filter($this->records, static fn ($memory) => $memory->treeId === $treeId));
        usort($items, static fn ($a, $b) => $a->slotIndex <=> $b->slotIndex);
        return $items;
    }

    public function findInTree(int $treeId, string $publicId): ?ChristmasTreeMemory
    {
        $memory = $this->records[$publicId] ?? null;
        return $memory?->treeId === $treeId ? $memory : null;
    }

    public function createInAvailableSlot(int $treeId, array $attributes, int $capacity): ChristmasTreeMemory
    {
        $used = array_fill_keys(array_map(static fn ($item) => $item->slotIndex, $this->forTree($treeId)), true);
        $slot = null;
        for ($index = 0; $index < $capacity; $index++) if (!isset($used[$index])) { $slot = $index; break; }
        if ($slot === null) throw new MemoryCapacityReached();
        $memory = new ChristmasTreeMemory(
            $this->nextId++, $treeId, (string) $attributes['public_id'], $slot, (int) $attributes['layout_version'],
            is_string($attributes['caption']) ? $attributes['caption'] : null, (string) $attributes['image_path'],
            (string) $attributes['created_at'], (string) $attributes['updated_at'],
        );
        return $this->records[$memory->publicId] = $memory;
    }

    public function updateInTree(int $treeId, string $publicId, array $attributes): ?array
    {
        $current = $this->findInTree($treeId, $publicId);
        if ($current === null) return null;
        $next = new ChristmasTreeMemory(
            $current->id, $treeId, $publicId, $current->slotIndex, $current->layoutVersion,
            is_string($attributes['caption']) ? $attributes['caption'] : null,
            is_string($attributes['image_path'] ?? null) ? $attributes['image_path'] : $current->imagePath,
            $current->createdAt, (string) $attributes['updated_at'],
        );
        $this->records[$publicId] = $next;
        return ['memory' => $next, 'old_image_path' => $current->imagePath];
    }

    public function deleteFromTree(int $treeId, string $publicId): ?string
    {
        $memory = $this->findInTree($treeId, $publicId);
        if ($memory === null) return null;
        unset($this->records[$publicId]);
        return $memory->imagePath;
    }
}

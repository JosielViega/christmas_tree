<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Domain\ChristmasTreeMemory;

interface ChristmasTreeMemoryRepository
{
    /** @return list<ChristmasTreeMemory> */
    public function forTree(int $treeId): array;

    public function findInTree(int $treeId, string $publicId): ?ChristmasTreeMemory;

    /** @param array<string, int|string|null> $attributes */
    public function createInAvailableSlot(int $treeId, array $attributes, int $capacity): ChristmasTreeMemory;

    /** @param array<string, string|null> $attributes
     *  @return null|array{memory: ChristmasTreeMemory, old_image_path: string}
     */
    public function updateInTree(int $treeId, string $publicId, array $attributes): ?array;

    public function deleteFromTree(int $treeId, string $publicId): ?string;
}

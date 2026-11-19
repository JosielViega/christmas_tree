<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Domain\ChristmasTreeOrnament;
use App\Domain\OrnamentCreation;

interface ChristmasTreeOrnamentRepository
{
    /** @return list<ChristmasTreeOrnament> */
    public function forTree(int $treeId): array;

    /** @param array{public_id: string, ornament_type: string, ornament_color: string, sender_name: string, layout_version: int, idempotency_key_hash: string, created_at: string} $attributes */
    public function createInAvailableSlot(int $treeId, array $attributes, int $slotCount): OrnamentCreation;

    public function deleteFromTree(int $treeId, string $ornamentPublicId): bool;
}

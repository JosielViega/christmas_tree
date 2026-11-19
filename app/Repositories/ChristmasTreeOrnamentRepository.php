<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Domain\ChristmasTreeOrnament;
use App\Domain\OrnamentCreation;
use App\Domain\PrivateTreeMessage;

interface ChristmasTreeOrnamentRepository
{
    /** @return list<ChristmasTreeOrnament> */
    public function forTree(int $treeId): array;

    /** @param array{public_id: string, ornament_type: string, ornament_color: string, sender_name: string, secret_message: string, message_payload_hash: string, layout_version: int, idempotency_key_hash: string, created_at: string} $attributes */
    public function createInAvailableSlot(int $treeId, array $attributes, int $slotCount): OrnamentCreation;

    public function deleteFromTree(int $treeId, string $ornamentPublicId): bool;

    public function messageCountForTree(int $treeId): int;

    /** @return list<PrivateTreeMessage> */
    public function privateMessagesForTree(int $treeId): array;
}

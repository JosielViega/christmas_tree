<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class ChristmasTreeOrnament
{
    public function __construct(
        public int $id,
        public int $treeId,
        public string $publicId,
        public string $type,
        public string $color,
        public string $senderName,
        public int $slotIndex,
        public int $layoutVersion,
        public string $createdAt,
    ) {
    }

    /** @return array{public_id: string, ornament_type: string, ornament_color: string, sender_name: string, slot_index: int, layout_version: int, created_at: string} */
    public function toPublicArray(): array
    {
        return [
            'public_id' => $this->publicId,
            'ornament_type' => $this->type,
            'ornament_color' => $this->color,
            'sender_name' => $this->senderName,
            'slot_index' => $this->slotIndex,
            'layout_version' => $this->layoutVersion,
            'created_at' => $this->createdAt,
        ];
    }
}

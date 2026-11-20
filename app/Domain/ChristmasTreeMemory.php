<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class ChristmasTreeMemory
{
    public function __construct(
        public int $id,
        public int $treeId,
        public string $publicId,
        public int $slotIndex,
        public int $layoutVersion,
        public ?string $caption,
        public string $imagePath,
        public string $createdAt,
        public string $updatedAt,
    ) {
    }

    /** @return array<string, int|string|null> */
    public function toPublicArray(string $treePublicId): array
    {
        return [
            'public_id' => $this->publicId,
            'slot_index' => $this->slotIndex,
            'layout_version' => $this->layoutVersion,
            'caption' => $this->caption,
            'image_url' => '/api/trees/' . rawurlencode($treePublicId) . '/memories/' . rawurlencode($this->publicId)
                . '/image?v=' . rawurlencode($this->updatedAt),
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class ChristmasTree
{
    public function __construct(
        public int $id,
        public string $publicId,
        public string $ownerName,
        public string $theme,
        public string $status,
        public string $createdAt,
        public string $updatedAt,
    ) {
    }

    /** @return array{public_id: string, owner_name: string, theme: string, status: string, created_at: string, updated_at: string} */
    public function toPublicArray(): array
    {
        return [
            'public_id' => $this->publicId,
            'owner_name' => $this->ownerName,
            'theme' => $this->theme,
            'status' => $this->status,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}

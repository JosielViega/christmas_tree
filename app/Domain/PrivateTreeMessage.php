<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class PrivateTreeMessage
{
    public function __construct(
        public string $ornamentPublicId,
        public string $senderName,
        public string $message,
        public string $createdAt,
    ) {
    }

    /** @return array{ornament_public_id: string, sender_name: string, message: string, created_at: string} */
    public function toPrivateArray(): array
    {
        return [
            'ornament_public_id' => $this->ornamentPublicId,
            'sender_name' => $this->senderName,
            'message' => $this->message,
            'created_at' => $this->createdAt,
        ];
    }
}

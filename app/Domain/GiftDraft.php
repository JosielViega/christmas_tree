<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class GiftDraft
{
    public function __construct(
        public int $id,
        public int $treeId,
        public string $publicId,
        public string $senderName,
        public string $giftStyle,
        public string $compositionMode,
        public string $status,
        public string $createdAt,
        public string $expiresAt,
    ) {
    }

    /** @return array<string, string> */
    public function toPrivateArray(): array
    {
        return [
            'public_id' => $this->publicId,
            'sender_name' => $this->senderName,
            'gift_style' => $this->giftStyle,
            'composition_mode' => $this->compositionMode,
            'status' => $this->status,
            'created_at' => $this->createdAt,
            'expires_at' => $this->expiresAt,
        ];
    }
}

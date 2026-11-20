<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class PublishedGift
{
    public function __construct(
        public int $id,
        public int $treeId,
        public string $publicId,
        public string $senderName,
        public string $giftStyle,
        public string $compositionMode,
        public int $positionIndex,
        public int $layoutVersion,
        public bool $hasMessage,
        public string $texturePath,
        public string $textureSha256,
        public string $publishedAt,
    ) {
    }

    public function toPublicArray(string $textureUrl): array
    {
        return [
            'public_id' => $this->publicId,
            'sender_name' => $this->senderName,
            'gift_style' => $this->giftStyle,
            'composition_mode' => $this->compositionMode,
            'position_index' => $this->positionIndex,
            'layout_version' => $this->layoutVersion,
            'has_message' => $this->hasMessage,
            'texture_url' => $textureUrl,
            'published_at' => $this->publishedAt,
        ];
    }
}

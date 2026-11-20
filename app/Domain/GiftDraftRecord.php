<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class GiftDraftRecord
{
    public function __construct(
        public GiftDraft $gift,
        public string $texturePath,
        public string $payloadHash,
        public string $accessTokenHash,
    ) {
    }
}

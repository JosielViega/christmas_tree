<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class GiftDraftCreation
{
    public function __construct(
        public GiftDraft $gift,
        public bool $created,
        public ?string $accessToken,
    ) {
    }
}

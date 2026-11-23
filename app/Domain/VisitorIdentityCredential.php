<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class VisitorIdentityCredential
{
    public function __construct(
        public int $id,
        public string $selector,
        public string $verifierHash,
        public string $expiresAt,
        public ?string $revokedAt,
    ) {
    }
}


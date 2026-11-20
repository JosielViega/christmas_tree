<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class PersistentTreeCredential
{
    public function __construct(
        public int $id,
        public ChristmasTree $tree,
        public string $selector,
        public string $verifierHash,
        public string $expiresAt,
        public ?string $revokedAt,
    ) {
    }
}

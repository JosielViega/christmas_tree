<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class TreeAccessRecord
{
    public function __construct(
        public ChristmasTree $tree,
        public string $adminTokenHash,
        public string $recoveryTokenHash,
    ) {
    }
}

<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class TreeCreation
{
    public function __construct(
        public ChristmasTree $tree,
        public string $adminToken,
        public string $recoveryCode,
    ) {
    }
}

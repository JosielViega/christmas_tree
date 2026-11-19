<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class OrnamentCreation
{
    public function __construct(
        public ChristmasTreeOrnament $ornament,
        public bool $created,
    ) {
    }
}

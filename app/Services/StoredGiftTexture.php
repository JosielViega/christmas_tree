<?php

declare(strict_types=1);

namespace App\Services;

final readonly class StoredGiftTexture
{
    public function __construct(public string $logicalPath, public string $contentHash)
    {
    }
}

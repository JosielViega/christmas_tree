<?php

declare(strict_types=1);

namespace App\Services;

final readonly class StoredMemoryImage
{
    public function __construct(public string $logicalPath)
    {
    }
}

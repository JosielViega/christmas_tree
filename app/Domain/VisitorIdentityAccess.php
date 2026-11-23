<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class VisitorIdentityAccess
{
    public function __construct(public int $identityId, public ?string $cookieValue)
    {
    }
}


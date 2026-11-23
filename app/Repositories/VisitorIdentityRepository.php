<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Domain\VisitorIdentityCredential;

interface VisitorIdentityRepository
{
    public function create(string $selector, string $verifierHash, string $createdAt, string $expiresAt): int;
    public function findBySelector(string $selector): ?VisitorIdentityCredential;
    public function touchIfActive(int $id, string $now): bool;
}


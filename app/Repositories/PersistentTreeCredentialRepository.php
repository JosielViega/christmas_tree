<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Domain\PersistentTreeCredential;

interface PersistentTreeCredentialRepository
{
    public function create(int $treeId, string $selector, string $verifierHash, string $createdAt, string $expiresAt): void;
    public function findBySelector(string $selector): ?PersistentTreeCredential;
    public function touchIfActive(int $id, string $now): bool;
    public function revokeSelector(string $selector, string $now): void;
    public function revokeForTree(int $treeId, string $now): void;
}

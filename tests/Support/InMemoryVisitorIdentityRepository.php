<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Domain\VisitorIdentityCredential;
use App\Repositories\VisitorIdentityRepository;

final class InMemoryVisitorIdentityRepository implements VisitorIdentityRepository
{
    /** @var array<string, VisitorIdentityCredential> */
    private array $records = [];
    private int $nextId = 1;

    public function create(string $selector, string $verifierHash, string $createdAt, string $expiresAt): int
    {
        $id = $this->nextId++;
        $this->records[$selector] = new VisitorIdentityCredential($id, $selector, $verifierHash, $expiresAt, null);
        return $id;
    }

    public function findBySelector(string $selector): ?VisitorIdentityCredential
    {
        return $this->records[$selector] ?? null;
    }

    public function touchIfActive(int $id, string $now): bool
    {
        foreach ($this->records as $record) {
            if ($record->id === $id && $record->revokedAt === null && $record->expiresAt > $now) return true;
        }
        return false;
    }
}


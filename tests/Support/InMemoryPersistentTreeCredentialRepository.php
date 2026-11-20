<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Domain\PersistentTreeCredential;
use App\Repositories\PersistentTreeCredentialRepository;

final class InMemoryPersistentTreeCredentialRepository implements PersistentTreeCredentialRepository
{
    /** @var array<string, array<string, mixed>> */
    public array $records = [];
    /** @var array<int, \App\Domain\ChristmasTree> */
    public array $trees = [];
    private int $nextId = 1;

    public function registerTree(\App\Domain\ChristmasTree $tree): void { $this->trees[$tree->id] = $tree; }

    public function create(int $treeId, string $selector, string $verifierHash, string $createdAt, string $expiresAt): void
    {
        $this->records[$selector] = compact('treeId', 'selector', 'verifierHash', 'createdAt', 'expiresAt') + [
            'id' => $this->nextId++, 'lastUsedAt' => null, 'revokedAt' => null,
        ];
    }

    public function findBySelector(string $selector): ?PersistentTreeCredential
    {
        $record = $this->records[$selector] ?? null;
        $tree = is_array($record) ? ($this->trees[$record['treeId']] ?? null) : null;
        return is_array($record) && $tree !== null ? new PersistentTreeCredential(
            $record['id'], $tree, $selector, $record['verifierHash'], $record['expiresAt'], $record['revokedAt'],
        ) : null;
    }

    public function touchIfActive(int $id, string $now): bool
    {
        foreach ($this->records as &$record) {
            if ($record['id'] !== $id || $record['revokedAt'] !== null || $record['expiresAt'] <= $now) continue;
            $record['lastUsedAt'] = $now;
            return true;
        }
        return false;
    }

    public function revokeSelector(string $selector, string $now): void
    {
        if (isset($this->records[$selector])) $this->records[$selector]['revokedAt'] ??= $now;
    }

    public function revokeForTree(int $treeId, string $now): void
    {
        foreach ($this->records as &$record) if ($record['treeId'] === $treeId) $record['revokedAt'] ??= $now;
    }
}

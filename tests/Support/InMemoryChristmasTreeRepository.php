<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Domain\ChristmasTree;
use App\Domain\TreeAccessRecord;
use App\Repositories\ChristmasTreeRepository;
use App\Repositories\DuplicatePublicId;

final class InMemoryChristmasTreeRepository implements ChristmasTreeRepository
{
    /** @var array<string, array{tree: ChristmasTree, admin_token_hash: string, recovery_token_hash: string}> */
    private array $records = [];
    private int $nextId = 1;

    public function publicIdExists(string $publicId): bool
    {
        return isset($this->records[$publicId]);
    }

    public function create(array $attributes): ChristmasTree
    {
        if ($this->publicIdExists($attributes['public_id'])) {
            throw new DuplicatePublicId();
        }

        $tree = new ChristmasTree(
            $this->nextId++,
            $attributes['public_id'],
            $attributes['owner_name'],
            $attributes['theme'],
            $attributes['status'],
            $attributes['created_at'],
            $attributes['updated_at'],
        );
        $this->records[$tree->publicId] = [
            'tree' => $tree,
            'admin_token_hash' => $attributes['admin_token_hash'],
            'recovery_token_hash' => $attributes['recovery_token_hash'],
        ];

        return $tree;
    }

    public function findPublic(string $publicId): ?ChristmasTree
    {
        $tree = $this->records[$publicId]['tree'] ?? null;

        return $tree instanceof ChristmasTree && $tree->status === 'active' ? $tree : null;
    }

    public function findForAccess(string $publicId): ?TreeAccessRecord
    {
        $record = $this->records[$publicId] ?? null;
        if (!is_array($record)) {
            return null;
        }

        return new TreeAccessRecord(
            $record['tree'],
            $record['admin_token_hash'],
            $record['recovery_token_hash'],
        );
    }

    public function rotateCredentials(int $treeId, string $expectedRecoveryTokenHash, string $adminTokenHash, string $recoveryTokenHash, string $updatedAt): bool
    {
        foreach ($this->records as $publicId => $record) {
            if ($record['tree']->id !== $treeId) {
                continue;
            }
            if (!hash_equals($record['recovery_token_hash'], $expectedRecoveryTokenHash)) {
                return false;
            }

            $tree = $record['tree'];
            $this->records[$publicId] = [
                'tree' => new ChristmasTree(
                    $tree->id,
                    $tree->publicId,
                    $tree->ownerName,
                    $tree->theme,
                    $tree->status,
                    $tree->createdAt,
                    $updatedAt,
                ),
                'admin_token_hash' => $adminTokenHash,
                'recovery_token_hash' => $recoveryTokenHash,
            ];
            return true;
        }

        return false;
    }
}

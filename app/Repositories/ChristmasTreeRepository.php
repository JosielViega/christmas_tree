<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Domain\ChristmasTree;
use App\Domain\TreeAccessRecord;

interface ChristmasTreeRepository
{
    public function publicIdExists(string $publicId): bool;

    /** @param array{public_id: string, owner_name: string, theme: string, status: string, admin_token_hash: string, recovery_token_hash: string, created_at: string, updated_at: string} $attributes */
    public function create(array $attributes): ChristmasTree;

    public function findPublic(string $publicId): ?ChristmasTree;

    public function findForAccess(string $publicId): ?TreeAccessRecord;

    public function rotateCredentials(int $treeId, string $expectedRecoveryTokenHash, string $adminTokenHash, string $recoveryTokenHash, string $updatedAt): bool;
}

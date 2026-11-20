<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Domain\GiftDraftPersistence;
use App\Domain\GiftDraftRecord;

interface ChristmasTreeGiftRepository
{
    /** @param array<string, int|string> $attributes */
    public function createOrFind(int $treeId, array $attributes): GiftDraftPersistence;

    public function findForAccess(string $publicId): ?GiftDraftRecord;

    public function findById(int $id): ?GiftDraftRecord;

    public function transition(string $publicId, string $from, string $to, string $now): bool;

    public function clearTexturePath(string $publicId): void;

    /** @return list<GiftDraftRecord> */
    public function cleanupCandidates(string $now, int $limit): array;
}

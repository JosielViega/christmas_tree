<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Domain\GiftDraft;
use App\Domain\GiftDraftPersistence;
use App\Domain\GiftDraftRecord;
use App\Domain\IdempotencyConflict;
use App\Repositories\ChristmasTreeGiftRepository;

final class InMemoryChristmasTreeGiftRepository implements ChristmasTreeGiftRepository
{
    /** @var array<string, GiftDraftRecord> */
    public array $records = [];
    private int $nextId = 1;

    public function createOrFind(int $treeId, array $attributes): GiftDraftPersistence
    {
        foreach ($this->records as $record) {
            if ($record->gift->treeId === $treeId
                && hash_equals((string) $attributes['idempotency_key_hash'], $this->keyHash($record))) {
                if (!hash_equals($record->payloadHash, (string) $attributes['payload_hash'])) {
                    throw new IdempotencyConflict('Conflicting payload.');
                }
                return new GiftDraftPersistence($record, false);
            }
        }
        $gift = new GiftDraft(
            $this->nextId++, $treeId, (string) $attributes['public_id'], (string) $attributes['sender_name'],
            (string) $attributes['gift_style'], (string) $attributes['composition_mode'], (string) $attributes['status'],
            (string) $attributes['created_at'], (string) $attributes['expires_at'],
        );
        $record = new GiftDraftRecord($gift, (string) $attributes['texture_path'], (string) $attributes['payload_hash'], (string) $attributes['access_token_hash']);
        $this->records[$gift->publicId] = $record;
        $this->idempotencyKeys[$gift->publicId] = (string) $attributes['idempotency_key_hash'];
        return new GiftDraftPersistence($record, true);
    }

    /** @var array<string, string> */
    private array $idempotencyKeys = [];

    public function findForAccess(string $publicId): ?GiftDraftRecord
    {
        return $this->records[$publicId] ?? null;
    }

    public function findById(int $id): ?GiftDraftRecord
    {
        foreach ($this->records as $record) if ($record->gift->id === $id) return $record;
        return null;
    }

    public function transition(string $publicId, string $from, string $to, string $now): bool
    {
        $record = $this->records[$publicId] ?? null;
        if ($record === null || $record->gift->status !== $from || ($to === 'expired' && $record->gift->expiresAt > $now)) {
            return false;
        }
        $gift = $record->gift;
        $next = new GiftDraft($gift->id, $gift->treeId, $gift->publicId, $gift->senderName, $gift->giftStyle, $gift->compositionMode, $to, $gift->createdAt, $gift->expiresAt);
        $this->records[$publicId] = new GiftDraftRecord($next, $record->texturePath, $record->payloadHash, $record->accessTokenHash);
        return true;
    }

    public function clearTexturePath(string $publicId): void
    {
        $record = $this->records[$publicId] ?? null;
        if ($record !== null) {
            $this->records[$publicId] = new GiftDraftRecord($record->gift, '', $record->payloadHash, $record->accessTokenHash);
        }
    }

    public function cleanupCandidates(string $now, int $limit): array
    {
        $records = array_filter($this->records, static fn (GiftDraftRecord $record): bool => $record->texturePath !== '' && (
            ($record->gift->status === 'draft' && $record->gift->expiresAt <= $now)
            || in_array($record->gift->status, ['cancelled', 'expired'], true)
        ));
        return array_slice(array_values($records), 0, $limit);
    }

    private function keyHash(GiftDraftRecord $record): string
    {
        return $this->idempotencyKeys[$record->gift->publicId] ?? '';
    }
}

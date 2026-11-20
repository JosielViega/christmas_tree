<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use App\Domain\GiftDraft;
use App\Domain\GiftDraftPersistence;
use App\Domain\GiftDraftRecord;
use App\Domain\IdempotencyConflict;
use PDO;
use PDOException;
use RuntimeException;
use Throwable;

final class PdoChristmasTreeGiftRepository implements ChristmasTreeGiftRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    public function createOrFind(int $treeId, array $attributes): GiftDraftPersistence
    {
        $pdo = $this->database->connection();
        $pdo->beginTransaction();
        try {
            $treeLock = $pdo->prepare('SELECT status FROM christmas_trees WHERE id = :tree_id FOR UPDATE');
            $treeLock->execute(['tree_id' => $treeId]);
            if ($treeLock->fetchColumn() !== 'active') {
                throw new RuntimeException('The tree does not accept gift drafts.');
            }
            $existing = $pdo->prepare(
                'SELECT * FROM christmas_tree_gifts WHERE tree_id = :tree_id AND idempotency_key_hash = :key_hash FOR UPDATE'
            );
            $existing->execute(['tree_id' => $treeId, 'key_hash' => $attributes['idempotency_key_hash']]);
            $row = $existing->fetch();
            if (is_array($row)) {
                if (!hash_equals((string) $row['payload_hash'], (string) $attributes['payload_hash'])) {
                    throw new IdempotencyConflict('The idempotency key was already used with different data.');
                }
                $pdo->commit();
                return new GiftDraftPersistence($this->hydrate($row), false);
            }

            $insert = $pdo->prepare(
                'INSERT INTO christmas_tree_gifts '
                . '(public_id, tree_id, sender_name, gift_style, composition_mode, message, texture_path, texture_sha256, status, '
                . 'idempotency_key_hash, payload_hash, access_token_hash, created_at, expires_at) VALUES '
                . '(:public_id, :tree_id, :sender_name, :gift_style, :composition_mode, :message, :texture_path, :texture_sha256, :status, '
                . ':idempotency_key_hash, :payload_hash, :access_token_hash, :created_at, :expires_at)'
            );
            $insert->execute(['tree_id' => $treeId, ...$attributes]);
            $record = new GiftDraftRecord(
                new GiftDraft(
                    (int) $pdo->lastInsertId(), $treeId, (string) $attributes['public_id'],
                    (string) $attributes['sender_name'], (string) $attributes['gift_style'],
                    (string) $attributes['composition_mode'], (string) $attributes['status'],
                    (string) $attributes['created_at'], (string) $attributes['expires_at'],
                ),
                (string) $attributes['texture_path'],
                (string) $attributes['payload_hash'],
                (string) $attributes['access_token_hash'],
            );
            $pdo->commit();
            return new GiftDraftPersistence($record, true);
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($exception instanceof PDOException && $exception->getCode() === '23000') {
                throw new RuntimeException('Unable to allocate a unique gift identifier.', previous: $exception);
            }
            throw $exception;
        }
    }

    public function findForAccess(string $publicId): ?GiftDraftRecord
    {
        $statement = $this->database->connection()->prepare('SELECT * FROM christmas_tree_gifts WHERE public_id = :public_id LIMIT 1');
        $statement->execute(['public_id' => $publicId]);
        $row = $statement->fetch();
        return is_array($row) ? $this->hydrate($row) : null;
    }

    public function findById(int $id): ?GiftDraftRecord
    {
        $statement = $this->database->connection()->prepare('SELECT * FROM christmas_tree_gifts WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        return is_array($row) ? $this->hydrate($row) : null;
    }

    public function transition(string $publicId, string $from, string $to, string $now): bool
    {
        $statement = $this->database->connection()->prepare(
            'UPDATE christmas_tree_gifts SET status = :next_status '
            . 'WHERE public_id = :public_id AND status = :current_status '
            . ($to === 'expired' ? 'AND expires_at <= :now ' : '')
            . (in_array($to, ['cancelled', 'expired'], true)
                ? "AND NOT EXISTS (SELECT 1 FROM christmas_tree_gift_orders gift_orders "
                    . "WHERE gift_orders.gift_id = christmas_tree_gifts.id AND gift_orders.status IN ('pending', 'paid'))"
                : '')
        );
        $parameters = ['public_id' => $publicId, 'current_status' => $from, 'next_status' => $to];
        if ($to === 'expired') {
            $parameters['now'] = $now;
        }
        $statement->execute($parameters);
        return $statement->rowCount() === 1;
    }

    public function clearTexturePath(string $publicId): void
    {
        $statement = $this->database->connection()->prepare(
            "UPDATE christmas_tree_gifts SET texture_path = NULL WHERE public_id = :public_id AND status IN ('cancelled', 'expired')"
        );
        $statement->execute(['public_id' => $publicId]);
    }

    public function cleanupCandidates(string $now, int $limit): array
    {
        $limit = max(1, min(500, $limit));
        $statement = $this->database->connection()->prepare(
            "SELECT gifts.* FROM christmas_tree_gifts gifts WHERE gifts.texture_path IS NOT NULL AND "
            . "((gifts.status = 'draft' AND gifts.expires_at <= :now AND NOT EXISTS ("
            . "SELECT 1 FROM christmas_tree_gift_orders gift_orders WHERE gift_orders.gift_id = gifts.id "
            . "AND gift_orders.status IN ('pending', 'paid'))) OR gifts.status IN ('cancelled', 'expired')) "
            . "ORDER BY gifts.expires_at ASC, gifts.id ASC LIMIT {$limit}"
        );
        $statement->execute(['now' => $now]);
        return array_map($this->hydrate(...), $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    /** @param array<string, mixed> $row */
    private function hydrate(array $row): GiftDraftRecord
    {
        return new GiftDraftRecord(
            new GiftDraft(
                (int) $row['id'], (int) $row['tree_id'], (string) $row['public_id'],
                (string) $row['sender_name'], (string) $row['gift_style'], (string) $row['composition_mode'],
                (string) $row['status'], (string) $row['created_at'], (string) $row['expires_at'],
            ),
            (string) ($row['texture_path'] ?? ''),
            (string) $row['payload_hash'],
            (string) $row['access_token_hash'],
        );
    }
}

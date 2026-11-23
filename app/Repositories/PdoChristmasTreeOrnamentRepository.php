<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use App\Domain\ChristmasTreeOrnament;
use App\Domain\IdempotencyConflict;
use App\Domain\OrnamentCapacityReached;
use App\Domain\OrnamentCreation;
use App\Domain\PrivateTreeMessage;
use App\Domain\VisitorAlreadyDecorated;
use PDO;
use PDOException;
use Throwable;

final class PdoChristmasTreeOrnamentRepository implements ChristmasTreeOrnamentRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    public function forTree(int $treeId): array
    {
        $statement = $this->database->connection()->prepare(
            'SELECT o.id, o.tree_id, o.public_id, o.ornament_type, o.ornament_color, o.sender_name, o.slot_index, o.layout_version, o.created_at, '
            . '(m.id IS NOT NULL) AS has_message FROM christmas_tree_ornaments o '
            . 'LEFT JOIN christmas_tree_messages m ON m.ornament_id = o.id '
            . 'WHERE o.tree_id = :tree_id ORDER BY o.slot_index ASC'
        );
        $statement->execute(['tree_id' => $treeId]);

        return array_map($this->hydrate(...), $statement->fetchAll());
    }

    public function createInAvailableSlot(int $treeId, array $attributes, int $slotCount): OrnamentCreation
    {
        $pdo = $this->database->connection();
        $pdo->beginTransaction();

        try {
            $treeLock = $pdo->prepare('SELECT status FROM christmas_trees WHERE id = :id FOR UPDATE');
            $treeLock->execute(['id' => $treeId]);
            if ($treeLock->fetchColumn() !== 'active') {
                throw new OrnamentCapacityReached('The tree does not accept ornaments.');
            }

            $existing = $pdo->prepare(
                'SELECT o.id, o.tree_id, o.public_id, o.ornament_type, o.ornament_color, o.sender_name, o.slot_index, o.layout_version, o.created_at, '
                . '(m.id IS NOT NULL) AS has_message, m.payload_hash AS message_payload_hash, p.visitor_identity_id '
                . 'FROM christmas_tree_ornaments o LEFT JOIN christmas_tree_messages m ON m.ornament_id = o.id '
                . 'LEFT JOIN christmas_tree_visitor_participations p ON p.ornament_id = o.id '
                . 'WHERE o.tree_id = :tree_id AND o.idempotency_key_hash = :key_hash LIMIT 1'
            );
            $existing->execute(['tree_id' => $treeId, 'key_hash' => $attributes['idempotency_key_hash']]);
            $row = $existing->fetch();
            if (is_array($row)) {
                if (!is_string($row['message_payload_hash'] ?? null)
                    || !hash_equals($row['message_payload_hash'], $attributes['message_payload_hash'])) {
                    throw new IdempotencyConflict('The idempotency key was already used with different data.');
                }
                if (is_int($attributes['visitor_identity_id'])
                    && (int) ($row['visitor_identity_id'] ?? 0) !== $attributes['visitor_identity_id']) {
                    throw new IdempotencyConflict('The idempotency key belongs to another visitor.');
                }
                $pdo->commit();
                return new OrnamentCreation($this->hydrate($row), false);
            }

            if (is_int($attributes['visitor_identity_id']) && $this->hasVisitorParticipated($treeId, $attributes['visitor_identity_id'])) {
                throw new VisitorAlreadyDecorated('The visitor already decorated this tree.');
            }

            $occupied = $pdo->prepare('SELECT slot_index FROM christmas_tree_ornaments WHERE tree_id = :tree_id ORDER BY slot_index');
            $occupied->execute(['tree_id' => $treeId]);
            $used = array_fill_keys(array_map('intval', $occupied->fetchAll(PDO::FETCH_COLUMN)), true);
            if (count($used) >= $slotCount) {
                throw new OrnamentCapacityReached('The tree is full.');
            }

            $available = [];
            for ($slot = 0; $slot < $slotCount; $slot++) {
                if (!isset($used[$slot])) {
                    $available[] = $slot;
                }
            }
            $selector = (int) hexdec(substr($attributes['idempotency_key_hash'], 0, 7));
            $slotIndex = $available[$selector % count($available)];

            $insert = $pdo->prepare(
                'INSERT INTO christmas_tree_ornaments '
                . '(tree_id, public_id, ornament_type, ornament_color, sender_name, slot_index, layout_version, idempotency_key_hash, created_at) '
                . 'VALUES (:tree_id, :public_id, :ornament_type, :ornament_color, :sender_name, :slot_index, :layout_version, :idempotency_key_hash, :created_at)'
            );
            $insert->execute([
                'tree_id' => $treeId,
                'public_id' => $attributes['public_id'],
                'ornament_type' => $attributes['ornament_type'],
                'ornament_color' => $attributes['ornament_color'],
                'sender_name' => $attributes['sender_name'],
                'slot_index' => $slotIndex,
                'layout_version' => $attributes['layout_version'],
                'idempotency_key_hash' => $attributes['idempotency_key_hash'],
                'created_at' => $attributes['created_at'],
            ]);

            $ornament = new ChristmasTreeOrnament(
                (int) $pdo->lastInsertId(),
                $treeId,
                $attributes['public_id'],
                $attributes['ornament_type'],
                $attributes['ornament_color'],
                $attributes['sender_name'],
                $slotIndex,
                $attributes['layout_version'],
                $attributes['created_at'],
                true,
            );

            $messageInsert = $pdo->prepare(
                'INSERT INTO christmas_tree_messages (ornament_id, message, payload_hash, created_at) '
                . 'VALUES (:ornament_id, :message, :payload_hash, :created_at)'
            );
            $messageInsert->execute([
                'ornament_id' => $ornament->id,
                'message' => $attributes['secret_message'],
                'payload_hash' => $attributes['message_payload_hash'],
                'created_at' => $attributes['created_at'],
            ]);
            if (is_int($attributes['visitor_identity_id'])) {
                try {
                    $participationInsert = $pdo->prepare(
                        'INSERT INTO christmas_tree_visitor_participations '
                        . '(tree_id, visitor_identity_id, ornament_id, participated_at) '
                        . 'VALUES (:tree_id, :visitor_identity_id, :ornament_id, :participated_at)'
                    );
                    $participationInsert->execute([
                        'tree_id' => $treeId,
                        'visitor_identity_id' => $attributes['visitor_identity_id'],
                        'ornament_id' => $ornament->id,
                        'participated_at' => $attributes['created_at'],
                    ]);
                } catch (PDOException $exception) {
                    if ($exception->getCode() === '23000') {
                        throw new VisitorAlreadyDecorated('The visitor already decorated this tree.', previous: $exception);
                    }
                    throw $exception;
                }
            }
            $pdo->commit();

            return new OrnamentCreation($ornament, true);
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
    }

    public function hasVisitorParticipated(int $treeId, int $visitorIdentityId): bool
    {
        $statement = $this->database->connection()->prepare(
            'SELECT 1 FROM christmas_tree_visitor_participations '
            . 'WHERE tree_id = :tree_id AND visitor_identity_id = :visitor_identity_id LIMIT 1'
        );
        $statement->execute(['tree_id' => $treeId, 'visitor_identity_id' => $visitorIdentityId]);
        return $statement->fetchColumn() !== false;
    }

    public function deleteFromTree(int $treeId, string $ornamentPublicId): bool
    {
        $statement = $this->database->connection()->prepare(
            'DELETE FROM christmas_tree_ornaments WHERE tree_id = :tree_id AND public_id = :public_id'
        );
        $statement->execute(['tree_id' => $treeId, 'public_id' => $ornamentPublicId]);

        return $statement->rowCount() === 1;
    }

    public function messageCountForTree(int $treeId): int
    {
        $statement = $this->database->connection()->prepare(
            'SELECT COUNT(*) FROM christmas_tree_messages m '
            . 'INNER JOIN christmas_tree_ornaments o ON o.id = m.ornament_id WHERE o.tree_id = :tree_id'
        );
        $statement->execute(['tree_id' => $treeId]);

        return (int) $statement->fetchColumn();
    }

    public function privateMessagesForTree(int $treeId): array
    {
        $statement = $this->database->connection()->prepare(
            'SELECT o.public_id AS ornament_public_id, o.sender_name, m.message, m.created_at '
            . 'FROM christmas_tree_messages m INNER JOIN christmas_tree_ornaments o ON o.id = m.ornament_id '
            . 'WHERE o.tree_id = :tree_id ORDER BY o.slot_index ASC'
        );
        $statement->execute(['tree_id' => $treeId]);

        return array_map(
            static fn (array $row): PrivateTreeMessage => new PrivateTreeMessage(
                (string) $row['ornament_public_id'],
                (string) $row['sender_name'],
                (string) $row['message'],
                (string) $row['created_at'],
            ),
            $statement->fetchAll(),
        );
    }

    /** @param array<string, mixed> $row */
    private function hydrate(array $row): ChristmasTreeOrnament
    {
        return new ChristmasTreeOrnament(
            (int) $row['id'],
            (int) $row['tree_id'],
            (string) $row['public_id'],
            (string) $row['ornament_type'],
            (string) $row['ornament_color'],
            (string) $row['sender_name'],
            (int) $row['slot_index'],
            (int) $row['layout_version'],
            (string) $row['created_at'],
            (bool) ($row['has_message'] ?? false),
        );
    }
}

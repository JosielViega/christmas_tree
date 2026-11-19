<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use App\Domain\ChristmasTreeOrnament;
use App\Domain\OrnamentCapacityReached;
use App\Domain\OrnamentCreation;
use PDO;
use Throwable;

final class PdoChristmasTreeOrnamentRepository implements ChristmasTreeOrnamentRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    public function forTree(int $treeId): array
    {
        $statement = $this->database->connection()->prepare(
            'SELECT id, tree_id, public_id, ornament_type, ornament_color, sender_name, slot_index, layout_version, created_at '
            . 'FROM christmas_tree_ornaments WHERE tree_id = :tree_id ORDER BY slot_index ASC'
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
                'SELECT id, tree_id, public_id, ornament_type, ornament_color, sender_name, slot_index, layout_version, created_at '
                . 'FROM christmas_tree_ornaments WHERE tree_id = :tree_id AND idempotency_key_hash = :key_hash LIMIT 1'
            );
            $existing->execute(['tree_id' => $treeId, 'key_hash' => $attributes['idempotency_key_hash']]);
            $row = $existing->fetch();
            if (is_array($row)) {
                $pdo->commit();
                return new OrnamentCreation($this->hydrate($row), false);
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
            );
            $pdo->commit();

            return new OrnamentCreation($ornament, true);
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
    }

    public function deleteFromTree(int $treeId, string $ornamentPublicId): bool
    {
        $statement = $this->database->connection()->prepare(
            'DELETE FROM christmas_tree_ornaments WHERE tree_id = :tree_id AND public_id = :public_id'
        );
        $statement->execute(['tree_id' => $treeId, 'public_id' => $ornamentPublicId]);

        return $statement->rowCount() === 1;
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
        );
    }
}

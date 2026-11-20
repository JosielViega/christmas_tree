<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use App\Domain\ChristmasTreeMemory;
use App\Domain\MemoryCapacityReached;
use PDO;
use Throwable;

final class PdoChristmasTreeMemoryRepository implements ChristmasTreeMemoryRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    public function forTree(int $treeId): array
    {
        $statement = $this->database->connection()->prepare(
            'SELECT * FROM christmas_tree_memories WHERE tree_id = :tree_id ORDER BY slot_index'
        );
        $statement->execute(['tree_id' => $treeId]);
        return array_map($this->hydrate(...), $statement->fetchAll());
    }

    public function findInTree(int $treeId, string $publicId): ?ChristmasTreeMemory
    {
        $statement = $this->database->connection()->prepare(
            'SELECT * FROM christmas_tree_memories WHERE tree_id = :tree_id AND public_id = :public_id LIMIT 1'
        );
        $statement->execute(['tree_id' => $treeId, 'public_id' => $publicId]);
        $row = $statement->fetch();
        return is_array($row) ? $this->hydrate($row) : null;
    }

    public function createInAvailableSlot(int $treeId, array $attributes, int $capacity): ChristmasTreeMemory
    {
        $pdo = $this->database->connection();
        $pdo->beginTransaction();
        try {
            $lock = $pdo->prepare('SELECT status FROM christmas_trees WHERE id = :id FOR UPDATE');
            $lock->execute(['id' => $treeId]);
            if ($lock->fetchColumn() !== 'active') throw new MemoryCapacityReached();
            $occupied = $pdo->prepare('SELECT slot_index FROM christmas_tree_memories WHERE tree_id = :tree_id ORDER BY slot_index');
            $occupied->execute(['tree_id' => $treeId]);
            $used = array_fill_keys(array_map('intval', $occupied->fetchAll(PDO::FETCH_COLUMN)), true);
            $slot = null;
            for ($candidate = 0; $candidate < $capacity; $candidate++) if (!isset($used[$candidate])) { $slot = $candidate; break; }
            if ($slot === null) throw new MemoryCapacityReached();
            $insert = $pdo->prepare(
                'INSERT INTO christmas_tree_memories '
                . '(public_id, tree_id, slot_index, layout_version, caption, image_path, created_at, updated_at) '
                . 'VALUES (:public_id, :tree_id, :slot_index, :layout_version, :caption, :image_path, :created_at, :updated_at)'
            );
            $insert->execute([
                'public_id' => $attributes['public_id'], 'tree_id' => $treeId, 'slot_index' => $slot,
                'layout_version' => $attributes['layout_version'], 'caption' => $attributes['caption'],
                'image_path' => $attributes['image_path'], 'created_at' => $attributes['created_at'],
                'updated_at' => $attributes['updated_at'],
            ]);
            $memory = new ChristmasTreeMemory(
                (int) $pdo->lastInsertId(), $treeId, (string) $attributes['public_id'], $slot,
                (int) $attributes['layout_version'], is_string($attributes['caption']) ? $attributes['caption'] : null,
                (string) $attributes['image_path'], (string) $attributes['created_at'], (string) $attributes['updated_at'],
            );
            $pdo->commit();
            return $memory;
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
    }

    public function updateInTree(int $treeId, string $publicId, array $attributes): ?array
    {
        $pdo = $this->database->connection();
        $pdo->beginTransaction();
        try {
            $select = $pdo->prepare('SELECT * FROM christmas_tree_memories WHERE tree_id = :tree_id AND public_id = :public_id FOR UPDATE');
            $select->execute(['tree_id' => $treeId, 'public_id' => $publicId]);
            $row = $select->fetch();
            if (!is_array($row)) { $pdo->rollBack(); return null; }
            $imagePath = is_string($attributes['image_path'] ?? null) ? $attributes['image_path'] : (string) $row['image_path'];
            $update = $pdo->prepare(
                'UPDATE christmas_tree_memories SET caption = :caption, image_path = :image_path, updated_at = :updated_at WHERE id = :id'
            );
            $update->execute(['caption' => $attributes['caption'], 'image_path' => $imagePath, 'updated_at' => $attributes['updated_at'], 'id' => $row['id']]);
            $pdo->commit();
            return [
                'memory' => new ChristmasTreeMemory(
                    (int) $row['id'], $treeId, $publicId, (int) $row['slot_index'], (int) $row['layout_version'],
                    is_string($attributes['caption']) ? $attributes['caption'] : null, $imagePath,
                    (string) $row['created_at'], (string) $attributes['updated_at'],
                ),
                'old_image_path' => (string) $row['image_path'],
            ];
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
    }

    public function deleteFromTree(int $treeId, string $publicId): ?string
    {
        $pdo = $this->database->connection();
        $pdo->beginTransaction();
        try {
            $select = $pdo->prepare('SELECT id, image_path FROM christmas_tree_memories WHERE tree_id = :tree_id AND public_id = :public_id FOR UPDATE');
            $select->execute(['tree_id' => $treeId, 'public_id' => $publicId]);
            $row = $select->fetch();
            if (!is_array($row)) { $pdo->rollBack(); return null; }
            $delete = $pdo->prepare('DELETE FROM christmas_tree_memories WHERE id = :id');
            $delete->execute(['id' => $row['id']]);
            $pdo->commit();
            return (string) $row['image_path'];
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
    }

    private function hydrate(array $row): ChristmasTreeMemory
    {
        return new ChristmasTreeMemory(
            (int) $row['id'], (int) $row['tree_id'], (string) $row['public_id'], (int) $row['slot_index'],
            (int) $row['layout_version'], is_string($row['caption']) ? $row['caption'] : null,
            (string) $row['image_path'], (string) $row['created_at'], (string) $row['updated_at'],
        );
    }
}

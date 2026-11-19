<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use App\Domain\ChristmasTree;
use App\Domain\TreeAccessRecord;
use PDOException;

final class PdoChristmasTreeRepository implements ChristmasTreeRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    public function publicIdExists(string $publicId): bool
    {
        $statement = $this->database->connection()->prepare(
            'SELECT 1 FROM christmas_trees WHERE public_id = :public_id LIMIT 1'
        );
        $statement->execute(['public_id' => $publicId]);

        return $statement->fetchColumn() !== false;
    }

    public function create(array $attributes): ChristmasTree
    {
        $statement = $this->database->connection()->prepare(
            'INSERT INTO christmas_trees '
            . '(public_id, owner_name, theme, status, admin_token_hash, recovery_token_hash, created_at, updated_at) '
            . 'VALUES (:public_id, :owner_name, :theme, :status, :admin_token_hash, :recovery_token_hash, :created_at, :updated_at)'
        );

        try {
            $statement->execute($attributes);
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23000') {
                throw new DuplicatePublicId('The generated public ID already exists.', previous: $exception);
            }

            throw $exception;
        }

        return new ChristmasTree(
            (int) $this->database->connection()->lastInsertId(),
            $attributes['public_id'],
            $attributes['owner_name'],
            $attributes['theme'],
            $attributes['status'],
            $attributes['created_at'],
            $attributes['updated_at'],
        );
    }

    public function findPublic(string $publicId): ?ChristmasTree
    {
        $statement = $this->database->connection()->prepare(
            'SELECT id, public_id, owner_name, theme, status, created_at, updated_at '
            . 'FROM christmas_trees WHERE public_id = :public_id AND status = :status LIMIT 1'
        );
        $statement->execute(['public_id' => $publicId, 'status' => 'active']);
        $row = $statement->fetch();

        return is_array($row) ? $this->hydrate($row) : null;
    }

    public function findForAccess(string $publicId): ?TreeAccessRecord
    {
        $statement = $this->database->connection()->prepare(
            'SELECT id, public_id, owner_name, theme, status, admin_token_hash, recovery_token_hash, created_at, updated_at '
            . 'FROM christmas_trees WHERE public_id = :public_id AND status = :status LIMIT 1'
        );
        $statement->execute(['public_id' => $publicId, 'status' => 'active']);
        $row = $statement->fetch();

        if (!is_array($row)) {
            return null;
        }

        return new TreeAccessRecord(
            $this->hydrate($row),
            (string) $row['admin_token_hash'],
            (string) $row['recovery_token_hash'],
        );
    }

    public function rotateCredentials(int $treeId, string $expectedRecoveryTokenHash, string $adminTokenHash, string $recoveryTokenHash, string $updatedAt): bool
    {
        $statement = $this->database->connection()->prepare(
            'UPDATE christmas_trees SET admin_token_hash = :admin_token_hash, '
            . 'recovery_token_hash = :recovery_token_hash, updated_at = :updated_at '
            . 'WHERE id = :id AND recovery_token_hash = :expected_recovery_token_hash'
        );
        $statement->execute([
            'id' => $treeId,
            'expected_recovery_token_hash' => $expectedRecoveryTokenHash,
            'admin_token_hash' => $adminTokenHash,
            'recovery_token_hash' => $recoveryTokenHash,
            'updated_at' => $updatedAt,
        ]);

        return $statement->rowCount() === 1;
    }

    /** @param array<string, mixed> $row */
    private function hydrate(array $row): ChristmasTree
    {
        return new ChristmasTree(
            (int) $row['id'],
            (string) $row['public_id'],
            (string) $row['owner_name'],
            (string) $row['theme'],
            (string) $row['status'],
            (string) $row['created_at'],
            (string) $row['updated_at'],
        );
    }
}

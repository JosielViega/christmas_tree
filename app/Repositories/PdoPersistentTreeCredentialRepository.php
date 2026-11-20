<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use App\Domain\ChristmasTree;
use App\Domain\PersistentTreeCredential;

final class PdoPersistentTreeCredentialRepository implements PersistentTreeCredentialRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    public function create(int $treeId, string $selector, string $verifierHash, string $createdAt, string $expiresAt): void
    {
        $statement = $this->database->connection()->prepare(
            'INSERT INTO christmas_tree_persistent_credentials '
            . '(tree_id, selector, verifier_hash, created_at, expires_at) '
            . 'VALUES (:tree_id, :selector, :verifier_hash, :created_at, :expires_at)'
        );
        $statement->execute([
            'tree_id' => $treeId, 'selector' => $selector, 'verifier_hash' => $verifierHash,
            'created_at' => $createdAt, 'expires_at' => $expiresAt,
        ]);
    }

    public function findBySelector(string $selector): ?PersistentTreeCredential
    {
        $statement = $this->database->connection()->prepare(
            'SELECT credentials.*, trees.public_id, trees.owner_name, trees.theme, trees.status, '
            . 'trees.created_at AS tree_created_at, trees.updated_at AS tree_updated_at '
            . 'FROM christmas_tree_persistent_credentials credentials '
            . 'INNER JOIN christmas_trees trees ON trees.id = credentials.tree_id '
            . 'WHERE credentials.selector = :selector LIMIT 1'
        );
        $statement->execute(['selector' => $selector]);
        $row = $statement->fetch();
        if (!is_array($row)) return null;
        return new PersistentTreeCredential(
            (int) $row['id'],
            new ChristmasTree(
                (int) $row['tree_id'], (string) $row['public_id'], (string) $row['owner_name'],
                (string) $row['theme'], (string) $row['status'], (string) $row['tree_created_at'], (string) $row['tree_updated_at'],
            ),
            (string) $row['selector'], (string) $row['verifier_hash'], (string) $row['expires_at'],
            isset($row['revoked_at']) ? (string) $row['revoked_at'] : null,
        );
    }

    public function touchIfActive(int $id, string $now): bool
    {
        $statement = $this->database->connection()->prepare(
            'UPDATE christmas_tree_persistent_credentials '
            . 'SET last_used_at = GREATEST(COALESCE(last_used_at, :initial_last_used_at), :last_used_at) '
            . 'WHERE id = :id AND revoked_at IS NULL AND expires_at > :expires_after'
        );
        $statement->execute([
            'id' => $id,
            'initial_last_used_at' => $now,
            'last_used_at' => $now,
            'expires_after' => $now,
        ]);
        if ($statement->rowCount() === 1) return true;

        // Two concurrent requests can persist the same timestamp. A zero changed-row
        // count is still valid only while the credential remains active.
        $active = $this->database->connection()->prepare(
            'SELECT 1 FROM christmas_tree_persistent_credentials '
            . 'WHERE id = :id AND revoked_at IS NULL AND expires_at > :expires_after LIMIT 1'
        );
        $active->execute(['id' => $id, 'expires_after' => $now]);
        return $active->fetchColumn() !== false;
    }

    public function revokeSelector(string $selector, string $now): void
    {
        $statement = $this->database->connection()->prepare(
            'UPDATE christmas_tree_persistent_credentials SET revoked_at = COALESCE(revoked_at, :now) WHERE selector = :selector'
        );
        $statement->execute(['selector' => $selector, 'now' => $now]);
    }

    public function revokeForTree(int $treeId, string $now): void
    {
        $statement = $this->database->connection()->prepare(
            'UPDATE christmas_tree_persistent_credentials SET revoked_at = COALESCE(revoked_at, :now) '
            . 'WHERE tree_id = :tree_id AND revoked_at IS NULL'
        );
        $statement->execute(['tree_id' => $treeId, 'now' => $now]);
    }
}

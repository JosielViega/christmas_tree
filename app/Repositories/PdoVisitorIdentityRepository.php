<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use App\Domain\VisitorIdentityCredential;

final class PdoVisitorIdentityRepository implements VisitorIdentityRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    public function create(string $selector, string $verifierHash, string $createdAt, string $expiresAt): int
    {
        $statement = $this->database->connection()->prepare(
            'INSERT INTO christmas_tree_visitor_identities (selector, verifier_hash, created_at, expires_at) '
            . 'VALUES (:selector, :verifier_hash, :created_at, :expires_at)'
        );
        $statement->execute([
            'selector' => $selector,
            'verifier_hash' => $verifierHash,
            'created_at' => $createdAt,
            'expires_at' => $expiresAt,
        ]);
        return (int) $this->database->connection()->lastInsertId();
    }

    public function findBySelector(string $selector): ?VisitorIdentityCredential
    {
        $statement = $this->database->connection()->prepare(
            'SELECT id, selector, verifier_hash, expires_at, revoked_at '
            . 'FROM christmas_tree_visitor_identities WHERE selector = :selector LIMIT 1'
        );
        $statement->execute(['selector' => $selector]);
        $row = $statement->fetch();
        return is_array($row) ? new VisitorIdentityCredential(
            (int) $row['id'], (string) $row['selector'], (string) $row['verifier_hash'],
            (string) $row['expires_at'], isset($row['revoked_at']) ? (string) $row['revoked_at'] : null,
        ) : null;
    }

    public function touchIfActive(int $id, string $now): bool
    {
        $statement = $this->database->connection()->prepare(
            'UPDATE christmas_tree_visitor_identities SET last_used_at = :last_used_at '
            . 'WHERE id = :id AND revoked_at IS NULL AND expires_at > :expires_after'
        );
        $statement->execute(['id' => $id, 'last_used_at' => $now, 'expires_after' => $now]);
        if ($statement->rowCount() === 1) return true;

        $active = $this->database->connection()->prepare(
            'SELECT 1 FROM christmas_tree_visitor_identities '
            . 'WHERE id = :id AND revoked_at IS NULL AND expires_at > :expires_after LIMIT 1'
        );
        $active->execute(['id' => $id, 'expires_after' => $now]);
        return $active->fetchColumn() !== false;
    }
}

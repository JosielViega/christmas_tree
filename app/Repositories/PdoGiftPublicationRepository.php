<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use App\Domain\PublishedGift;
use PDO;
use RuntimeException;
use Throwable;

final class PdoGiftPublicationRepository implements GiftPublicationRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    public function publish(string $giftPublicId, string $textureSha256, string $now, int $layoutVersion): ?PublishedGift
    {
        $pdo = $this->database->connection();
        $pdo->beginTransaction();
        try {
            $statement = $pdo->prepare(
                'SELECT gifts.*, gift_orders.status AS order_status FROM christmas_tree_gifts gifts '
                . 'LEFT JOIN christmas_tree_gift_orders gift_orders ON gift_orders.gift_id = gifts.id '
                . 'WHERE gifts.public_id = :public_id FOR UPDATE'
            );
            $statement->execute(['public_id' => $giftPublicId]);
            $row = $statement->fetch(PDO::FETCH_ASSOC);
            if (!is_array($row)) {
                $pdo->commit();
                return null;
            }
            if ((string) $row['status'] === 'published') {
                $pdo->commit();
                return $this->hydrate($row);
            }
            if ((string) $row['status'] !== 'paid' || (string) ($row['order_status'] ?? '') !== 'paid') {
                throw new RuntimeException('Gift is not backed by a confirmed payment.');
            }
            $storedHash = (string) ($row['texture_sha256'] ?? '');
            if ($storedHash !== '' && !hash_equals($storedHash, $textureSha256)) {
                throw new RuntimeException('Gift texture integrity check failed.');
            }
            $treeLock = $pdo->prepare('SELECT id FROM christmas_trees WHERE id = :tree_id FOR UPDATE');
            $treeLock->execute(['tree_id' => (int) $row['tree_id']]);
            if ($treeLock->fetchColumn() === false) {
                throw new RuntimeException('Gift tree is unavailable.');
            }
            $position = $pdo->prepare(
                'SELECT COALESCE(MAX(position_index), -1) + 1 FROM christmas_tree_gifts '
                . 'WHERE tree_id = :tree_id AND layout_version = :layout_version'
            );
            $position->execute(['tree_id' => (int) $row['tree_id'], 'layout_version' => $layoutVersion]);
            $positionIndex = (int) $position->fetchColumn();
            $update = $pdo->prepare(
                "UPDATE christmas_tree_gifts SET status = 'published', texture_sha256 = :texture_sha256, "
                . 'position_index = :position_index, layout_version = :layout_version, published_at = COALESCE(published_at, :published_at), '
                . 'is_visible = 1, hidden_at = NULL WHERE id = :id AND status = \'paid\''
            );
            $update->execute([
                'texture_sha256' => $textureSha256,
                'position_index' => $positionIndex,
                'layout_version' => $layoutVersion,
                'published_at' => $now,
                'id' => (int) $row['id'],
            ]);
            if ($update->rowCount() !== 1) {
                throw new RuntimeException('Gift publication lost its state transition.');
            }
            $statement->execute(['public_id' => $giftPublicId]);
            $published = $statement->fetch(PDO::FETCH_ASSOC);
            $pdo->commit();
            return is_array($published) ? $this->hydrate($published) : null;
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
    }

    public function publishedForTree(int $treeId): array
    {
        $statement = $this->database->connection()->prepare(
            "SELECT gifts.* FROM christmas_tree_gifts gifts INNER JOIN christmas_tree_gift_orders gift_orders ON gift_orders.gift_id = gifts.id "
            . "WHERE gifts.tree_id = :tree_id AND gifts.status = 'published' AND gifts.is_visible = 1 AND gift_orders.status = 'paid' "
            . 'ORDER BY gifts.position_index ASC'
        );
        $statement->execute(['tree_id' => $treeId]);
        return array_map($this->hydrate(...), $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    public function findVisiblePublished(string $giftPublicId): ?PublishedGift
    {
        $statement = $this->database->connection()->prepare(
            "SELECT gifts.* FROM christmas_tree_gifts gifts INNER JOIN christmas_tree_gift_orders gift_orders ON gift_orders.gift_id = gifts.id "
            . "WHERE gifts.public_id = :public_id AND gifts.status = 'published' AND gifts.is_visible = 1 AND gift_orders.status = 'paid' LIMIT 1"
        );
        $statement->execute(['public_id' => $giftPublicId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $this->hydrate($row) : null;
    }

    public function paidGiftIdsForPublication(int $limit): array
    {
        $limit = max(1, min(100, $limit));
        $statement = $this->database->connection()->query(
            "SELECT gifts.public_id FROM christmas_tree_gifts gifts INNER JOIN christmas_tree_gift_orders gift_orders ON gift_orders.gift_id = gifts.id "
            . "WHERE gifts.status = 'paid' AND gift_orders.status = 'paid' ORDER BY gifts.paid_at ASC, gifts.id ASC LIMIT {$limit}"
        );
        return array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    public function hide(int $treeId, string $giftPublicId, string $now): bool
    {
        $statement = $this->database->connection()->prepare(
            "UPDATE christmas_tree_gifts SET is_visible = 0, hidden_at = COALESCE(hidden_at, :hidden_at) "
            . "WHERE tree_id = :tree_id AND public_id = :public_id AND status = 'published' AND is_visible = 1"
        );
        $statement->execute(['hidden_at' => $now, 'tree_id' => $treeId, 'public_id' => $giftPublicId]);
        return $statement->rowCount() === 1;
    }

    public function revealedMessage(int $treeId, string $giftPublicId): ?string
    {
        $statement = $this->database->connection()->prepare(
            "SELECT message FROM christmas_tree_gifts WHERE tree_id = :tree_id AND public_id = :public_id AND status = 'published' LIMIT 1"
        );
        $statement->execute(['tree_id' => $treeId, 'public_id' => $giftPublicId]);
        $message = $statement->fetchColumn();
        return is_string($message) ? $message : null;
    }

    /** @param array<string, mixed> $row */
    private function hydrate(array $row): PublishedGift
    {
        return new PublishedGift(
            (int) $row['id'], (int) $row['tree_id'], (string) $row['public_id'], (string) $row['sender_name'],
            (string) $row['gift_style'], (string) $row['composition_mode'], (int) $row['position_index'],
            (int) $row['layout_version'], trim((string) $row['message']) !== '', (string) $row['texture_path'],
            (string) ($row['texture_sha256'] ?? ''), (string) $row['published_at'],
        );
    }
}

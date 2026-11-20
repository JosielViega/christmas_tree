<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use App\Domain\IdempotencyConflict;
use App\Domain\PaymentCharge;
use App\Domain\PaymentNotification;
use App\Domain\PaymentOrder;
use App\Domain\PaymentOrderPersistence;
use App\Domain\PaymentOrderStatus;
use PDO;
use RuntimeException;
use Throwable;

final class PdoPaymentOrderRepository implements PaymentOrderRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    public function createOrFind(int $giftId, array $attributes): PaymentOrderPersistence
    {
        $pdo = $this->database->connection();
        $pdo->beginTransaction();
        try {
            $gift = $pdo->prepare('SELECT status FROM christmas_tree_gifts WHERE id = :id FOR UPDATE');
            $gift->execute(['id' => $giftId]);
            $giftStatus = $gift->fetchColumn();
            if ($giftStatus === false) throw new RuntimeException('Gift draft not found.');

            $existing = $pdo->prepare('SELECT * FROM christmas_tree_gift_orders WHERE gift_id = :gift_id FOR UPDATE');
            $existing->execute(['gift_id' => $giftId]);
            $row = $existing->fetch();
            if (is_array($row)) {
                if (!hash_equals((string) $row['request_hash'], (string) $attributes['request_hash'])) {
                    throw new IdempotencyConflict('This gift already has an order with different terms.');
                }
                $pdo->commit();
                return new PaymentOrderPersistence($this->hydrate($row), false);
            }
            if ($giftStatus !== 'draft') throw new RuntimeException('Gift draft does not accept a payment order.');

            $insert = $pdo->prepare(
                'INSERT INTO christmas_tree_gift_orders '
                . '(public_id, gift_id, product_code, amount_cents, currency, price_version, provider, status, '
                . 'idempotency_key_hash, request_hash, created_at, updated_at, expires_at) VALUES '
                . '(:public_id, :gift_id, :product_code, :amount_cents, :currency, :price_version, :provider, :status, '
                . ':idempotency_key_hash, :request_hash, :created_at, :updated_at, :expires_at)'
            );
            $insert->execute(['gift_id' => $giftId, ...$attributes]);
            $id = (int) $pdo->lastInsertId();
            $pdo->commit();
            $created = $this->findById($id);
            if ($created === null) throw new RuntimeException('Payment order was not persisted.');
            return new PaymentOrderPersistence($created, true);
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
    }

    public function findByGiftId(int $giftId): ?PaymentOrder
    {
        $statement = $this->database->connection()->prepare('SELECT * FROM christmas_tree_gift_orders WHERE gift_id = :gift_id LIMIT 1');
        $statement->execute(['gift_id' => $giftId]);
        $row = $statement->fetch();
        return is_array($row) ? $this->hydrate($row) : null;
    }

    public function findByPublicId(string $publicId): ?PaymentOrder
    {
        $statement = $this->database->connection()->prepare('SELECT * FROM christmas_tree_gift_orders WHERE public_id = :public_id LIMIT 1');
        $statement->execute(['public_id' => $publicId]);
        $row = $statement->fetch();
        return is_array($row) ? $this->hydrate($row) : null;
    }

    public function findByProviderOrderId(string $provider, string $providerOrderId): ?PaymentOrder
    {
        $statement = $this->database->connection()->prepare(
            'SELECT * FROM christmas_tree_gift_orders WHERE provider = :provider AND provider_order_id = :provider_order_id LIMIT 1'
        );
        $statement->execute(['provider' => $provider, 'provider_order_id' => $providerOrderId]);
        $row = $statement->fetch();
        return is_array($row) ? $this->hydrate($row) : null;
    }

    public function applyCharge(int $orderId, PaymentCharge $charge, string $now, ?PaymentNotification $notification = null): PaymentOrder
    {
        $pdo = $this->database->connection();
        $pdo->beginTransaction();
        try {
            $statement = $pdo->prepare('SELECT * FROM christmas_tree_gift_orders WHERE id = :id FOR UPDATE');
            $statement->execute(['id' => $orderId]);
            $row = $statement->fetch();
            if (!is_array($row)) throw new RuntimeException('Payment order not found.');

            if ($notification !== null) {
                $event = $pdo->prepare(
                    'INSERT IGNORE INTO christmas_tree_payment_events '
                    . '(order_id, provider, event_key, provider_resource_id, event_type, processed_at) '
                    . 'VALUES (:order_id, :provider, :event_key, :resource_id, :event_type, :processed_at)'
                );
                $event->execute([
                    'order_id' => $orderId, 'provider' => (string) $row['provider'], 'event_key' => $notification->eventKey,
                    'resource_id' => $notification->resourceId, 'event_type' => $notification->eventType, 'processed_at' => $now,
                ]);
                if ($event->rowCount() === 0) {
                    $pdo->commit();
                    return $this->hydrate($row);
                }
            }

            $currentStatus = (string) $row['status'];
            $nextStatus = PaymentOrderStatus::canTransition($currentStatus, $charge->status) ? $charge->status : $currentStatus;
            $update = $pdo->prepare(
                'UPDATE christmas_tree_gift_orders SET provider_order_id = :provider_order_id, '
                . 'provider_payment_id = COALESCE(:provider_payment_id, provider_payment_id), provider_live_mode = :live_mode, '
                . 'status = :status, pix_qr_code = COALESCE(:qr_code, pix_qr_code), '
                . 'pix_qr_code_base64 = COALESCE(:qr_base64, pix_qr_code_base64), '
                . 'pix_ticket_url = COALESCE(:ticket_url, pix_ticket_url), updated_at = :updated_at, '
                . "paid_at = CASE WHEN :paid_status = 'paid' THEN COALESCE(paid_at, :paid_at) ELSE paid_at END WHERE id = :id"
            );
            $update->execute([
                'provider_order_id' => $charge->providerOrderId, 'provider_payment_id' => $charge->providerPaymentId,
                'live_mode' => $charge->liveMode ? 1 : 0, 'status' => $nextStatus, 'qr_code' => $charge->qrCode,
                'qr_base64' => $charge->qrCodeBase64, 'ticket_url' => $charge->ticketUrl, 'updated_at' => $now,
                'paid_status' => $nextStatus, 'paid_at' => $now, 'id' => $orderId,
            ]);
            if ($nextStatus === PaymentOrderStatus::PAID) {
                $gift = $pdo->prepare("UPDATE christmas_tree_gifts SET status = 'paid', paid_at = COALESCE(paid_at, :paid_at) WHERE id = :id AND status = 'draft'");
                $gift->execute(['paid_at' => $now, 'id' => (int) $row['gift_id']]);
            }
            if ($nextStatus === PaymentOrderStatus::REFUNDED) {
                $gift = $pdo->prepare(
                    "UPDATE christmas_tree_gifts SET is_visible = 0, hidden_at = COALESCE(hidden_at, :hidden_at) "
                    . "WHERE id = :id AND status = 'published'"
                );
                $gift->execute(['hidden_at' => $now, 'id' => (int) $row['gift_id']]);
            }
            $statement->execute(['id' => $orderId]);
            $updated = $statement->fetch();
            $pdo->commit();
            if (!is_array($updated)) throw new RuntimeException('Payment order update could not be read.');
            return $this->hydrate($updated);
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
    }

    public function pendingForReconciliation(int $limit): array
    {
        $limit = max(1, min(100, $limit));
        $statement = $this->database->connection()->query(
            "SELECT * FROM christmas_tree_gift_orders WHERE status = 'pending' AND provider_order_id IS NOT NULL ORDER BY updated_at ASC LIMIT {$limit}"
        );
        return array_map($this->hydrate(...), $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    public function markFailedIfUnbound(int $orderId, string $now): void
    {
        $statement = $this->database->connection()->prepare(
            "UPDATE christmas_tree_gift_orders SET status = 'failed', updated_at = :updated_at "
            . "WHERE id = :id AND status = 'pending' AND provider_order_id IS NULL"
        );
        $statement->execute(['updated_at' => $now, 'id' => $orderId]);
    }

    private function findById(int $id): ?PaymentOrder
    {
        $statement = $this->database->connection()->prepare('SELECT * FROM christmas_tree_gift_orders WHERE id = :id');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        return is_array($row) ? $this->hydrate($row) : null;
    }

    /** @param array<string, mixed> $row */
    private function hydrate(array $row): PaymentOrder
    {
        return new PaymentOrder(
            (int) $row['id'], (string) $row['public_id'], (int) $row['gift_id'], (string) $row['product_code'],
            (int) $row['amount_cents'], (string) $row['currency'], (string) $row['price_version'], (string) $row['provider'],
            isset($row['provider_order_id']) ? (string) $row['provider_order_id'] : null,
            isset($row['provider_payment_id']) ? (string) $row['provider_payment_id'] : null,
            (string) $row['status'], isset($row['pix_qr_code']) ? (string) $row['pix_qr_code'] : null,
            isset($row['pix_qr_code_base64']) ? (string) $row['pix_qr_code_base64'] : null,
            isset($row['pix_ticket_url']) ? (string) $row['pix_ticket_url'] : null,
            (string) $row['created_at'], (string) $row['updated_at'], (string) $row['expires_at'],
            isset($row['paid_at']) ? (string) $row['paid_at'] : null,
        );
    }
}

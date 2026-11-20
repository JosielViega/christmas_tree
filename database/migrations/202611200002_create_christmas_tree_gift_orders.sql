CREATE TABLE christmas_tree_gift_orders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    gift_id BIGINT UNSIGNED NOT NULL,
    product_code VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    amount_cents INT UNSIGNED NOT NULL,
    currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    price_version VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    provider VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    provider_order_id VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NULL,
    provider_payment_id VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NULL,
    provider_live_mode TINYINT(1) NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    idempotency_key_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    pix_qr_code TEXT NULL,
    pix_qr_code_base64 MEDIUMTEXT NULL,
    pix_ticket_url VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    paid_at DATETIME(6) NULL,
    UNIQUE KEY uq_christmas_tree_gift_orders_public_id (public_id),
    UNIQUE KEY uq_christmas_tree_gift_orders_gift (gift_id),
    UNIQUE KEY uq_christmas_tree_gift_orders_provider_order (provider, provider_order_id),
    UNIQUE KEY uq_christmas_tree_gift_orders_idempotency (gift_id, idempotency_key_hash),
    KEY idx_christmas_tree_gift_orders_status_expiry (status, expires_at),
    CONSTRAINT fk_christmas_tree_gift_orders_gift
        FOREIGN KEY (gift_id) REFERENCES christmas_tree_gifts (id) ON DELETE RESTRICT,
    CONSTRAINT chk_christmas_tree_gift_orders_amount CHECK (amount_cents > 0),
    CONSTRAINT chk_christmas_tree_gift_orders_status
        CHECK (status IN ('pending', 'paid', 'expired', 'cancelled', 'refunded', 'failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE christmas_tree_payment_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    event_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    provider_resource_id VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    event_type VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    processed_at DATETIME(6) NOT NULL,
    UNIQUE KEY uq_christmas_tree_payment_events_provider_key (provider, event_key),
    KEY idx_christmas_tree_payment_events_order (order_id, processed_at),
    CONSTRAINT fk_christmas_tree_payment_events_order
        FOREIGN KEY (order_id) REFERENCES christmas_tree_gift_orders (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

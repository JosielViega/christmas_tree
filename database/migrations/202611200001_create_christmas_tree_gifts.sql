CREATE TABLE christmas_tree_gifts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    tree_id BIGINT UNSIGNED NOT NULL,
    sender_name VARCHAR(40) NOT NULL,
    gift_style VARCHAR(20) NOT NULL,
    composition_mode VARCHAR(20) NOT NULL,
    message VARCHAR(500) NOT NULL,
    texture_path VARCHAR(255) NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'draft',
    idempotency_key_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    access_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    paid_at DATETIME(6) NULL,
    published_at DATETIME(6) NULL,
    UNIQUE KEY uq_christmas_tree_gifts_public_id (public_id),
    UNIQUE KEY uq_christmas_tree_gifts_tree_idempotency (tree_id, idempotency_key_hash),
    KEY idx_christmas_tree_gifts_tree_status (tree_id, status),
    KEY idx_christmas_tree_gifts_cleanup (status, expires_at),
    CONSTRAINT fk_christmas_tree_gifts_tree
        FOREIGN KEY (tree_id) REFERENCES christmas_trees (id) ON DELETE CASCADE,
    CONSTRAINT chk_christmas_tree_gifts_status
        CHECK (status IN ('draft', 'paid', 'published', 'cancelled', 'expired'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

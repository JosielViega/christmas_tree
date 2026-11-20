CREATE TABLE christmas_tree_persistent_credentials (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tree_id BIGINT UNSIGNED NOT NULL,
    selector CHAR(22) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    verifier_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL,
    last_used_at DATETIME(6) NULL,
    expires_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    UNIQUE KEY uq_tree_persistent_credentials_selector (selector),
    KEY idx_tree_persistent_credentials_tree (tree_id, revoked_at, expires_at),
    KEY idx_tree_persistent_credentials_expiry (expires_at, revoked_at),
    CONSTRAINT fk_tree_persistent_credentials_tree
        FOREIGN KEY (tree_id) REFERENCES christmas_trees (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

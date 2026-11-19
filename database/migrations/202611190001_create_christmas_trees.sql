CREATE TABLE christmas_trees (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    owner_name VARCHAR(60) NOT NULL,
    theme VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'classic',
    status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
    admin_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    recovery_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY christmas_trees_public_id_unique (public_id),
    KEY christmas_trees_status_created_at_index (status, created_at),
    CONSTRAINT christmas_trees_status_check CHECK (status IN ('active', 'archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

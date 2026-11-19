CREATE TABLE christmas_tree_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ornament_id BIGINT UNSIGNED NOT NULL,
    message VARCHAR(500) NOT NULL,
    payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY christmas_tree_messages_ornament_unique (ornament_id),
    CONSTRAINT christmas_tree_messages_ornament_foreign FOREIGN KEY (ornament_id) REFERENCES christmas_tree_ornaments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

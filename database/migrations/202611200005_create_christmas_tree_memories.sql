CREATE TABLE christmas_tree_memories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    tree_id BIGINT UNSIGNED NOT NULL,
    slot_index TINYINT UNSIGNED NOT NULL,
    layout_version TINYINT UNSIGNED NOT NULL DEFAULT 1,
    caption VARCHAR(80) NULL,
    image_path VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY uq_christmas_tree_memories_public_id (public_id),
    UNIQUE KEY uq_christmas_tree_memories_slot (tree_id, slot_index),
    KEY idx_christmas_tree_memories_tree (tree_id),
    CONSTRAINT fk_christmas_tree_memories_tree
        FOREIGN KEY (tree_id) REFERENCES christmas_trees (id) ON DELETE CASCADE,
    CONSTRAINT chk_christmas_tree_memories_slot CHECK (slot_index < 6),
    CONSTRAINT chk_christmas_tree_memories_layout CHECK (layout_version = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

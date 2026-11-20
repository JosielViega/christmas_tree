ALTER TABLE christmas_tree_gifts
    ADD COLUMN texture_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER texture_path,
    ADD COLUMN position_index SMALLINT UNSIGNED NULL AFTER published_at,
    ADD COLUMN layout_version TINYINT UNSIGNED NULL AFTER position_index,
    ADD COLUMN is_visible TINYINT(1) NOT NULL DEFAULT 1 AFTER layout_version,
    ADD COLUMN hidden_at DATETIME(6) NULL AFTER is_visible,
    ADD UNIQUE KEY uq_christmas_tree_gifts_position (tree_id, layout_version, position_index),
    ADD KEY idx_christmas_tree_gifts_publication (status, is_visible, published_at);

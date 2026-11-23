CREATE TABLE christmas_tree_visitor_identities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    selector CHAR(22) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    verifier_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL,
    last_used_at DATETIME(6) NULL,
    expires_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tree_visitor_identities_selector (selector),
    KEY idx_tree_visitor_identities_expiry (expires_at, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE christmas_tree_visitor_participations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tree_id BIGINT UNSIGNED NOT NULL,
    visitor_identity_id BIGINT UNSIGNED NOT NULL,
    ornament_id BIGINT UNSIGNED NULL,
    participated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tree_visitor_participation (tree_id, visitor_identity_id),
    UNIQUE KEY uq_tree_visitor_participation_ornament (ornament_id),
    CONSTRAINT fk_tree_visitor_participation_tree FOREIGN KEY (tree_id)
        REFERENCES christmas_trees (id) ON DELETE CASCADE,
    CONSTRAINT fk_tree_visitor_participation_identity FOREIGN KEY (visitor_identity_id)
        REFERENCES christmas_tree_visitor_identities (id) ON DELETE CASCADE,
    CONSTRAINT fk_tree_visitor_participation_ornament FOREIGN KEY (ornament_id)
        REFERENCES christmas_tree_ornaments (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

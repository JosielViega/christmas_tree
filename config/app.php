<?php

declare(strict_types=1);

$giftStoragePath = trim((string) env('GIFT_PRIVATE_STORAGE_PATH', ''));
if ($giftStoragePath === '') {
    $giftStoragePath = dirname(__DIR__) . '/storage/private/gift-textures';
} elseif (preg_match('#^(?:[A-Za-z]:[\\\\/]|/)#', $giftStoragePath) !== 1) {
    $giftStoragePath = dirname(__DIR__) . '/' . ltrim(str_replace('\\', '/', $giftStoragePath), '/');
}

return [
    'name' => (string) env('APP_NAME', 'Christmas Tree'),
    'environment' => (string) env('APP_ENV', 'production'),
    'debug' => (bool) env('APP_DEBUG', false),
    'url' => (string) env('APP_URL', 'http://localhost'),
    'port' => (int) env('APP_PORT', 0),
    'timezone' => (string) env('APP_TIMEZONE', 'UTC'),
    'session' => [
        'name' => (string) env('SESSION_NAME', 'christmas_tree_session'),
        'secure' => (bool) env('SESSION_SECURE', false),
    ],
    'ornaments' => [
        'capacity' => (int) env('ORNAMENT_MAX_PER_TREE', 60),
    ],
    'messages' => [
        'reveal_at' => (string) env('MESSAGE_REVEAL_AT', '2026-12-25 00:00:00'),
        'reveal_timezone' => (string) env('MESSAGE_REVEAL_TIMEZONE', 'America/Sao_Paulo'),
    ],
    'gifts' => [
        'private_storage_path' => $giftStoragePath,
        'max_texture_bytes' => (int) env('GIFT_TEXTURE_MAX_BYTES', 2097152),
        'max_request_bytes' => (int) env('GIFT_REQUEST_MAX_BYTES', 2359296),
        'draft_expiration_hours' => (int) env('GIFT_DRAFT_EXPIRATION_HOURS', 24),
        'cleanup_batch_size' => (int) env('GIFT_CLEANUP_BATCH_SIZE', 100),
    ],
    'rate_limits' => [
        'tree_creation' => [
            'max_attempts' => (int) env('TREE_CREATE_RATE_LIMIT', 5),
            'window_seconds' => (int) env('TREE_CREATE_RATE_WINDOW', 900),
        ],
        'tree_recovery' => [
            'max_attempts' => (int) env('TREE_RECOVERY_RATE_LIMIT', 10),
            'window_seconds' => (int) env('TREE_RECOVERY_RATE_WINDOW', 900),
        ],
        'ornament_creation' => [
            'max_attempts' => (int) env('ORNAMENT_CREATE_RATE_LIMIT', 12),
            'window_seconds' => (int) env('ORNAMENT_CREATE_RATE_WINDOW', 900),
        ],
        'gift_draft_creation' => [
            'max_attempts' => (int) env('GIFT_DRAFT_RATE_LIMIT', 6),
            'window_seconds' => (int) env('GIFT_DRAFT_RATE_WINDOW', 900),
        ],
    ],
];

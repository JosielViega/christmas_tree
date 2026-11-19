<?php

declare(strict_types=1);

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
    ],
];

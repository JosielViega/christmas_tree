<?php

declare(strict_types=1);

$appEnvironment = (string) env('APP_ENV', 'production');
$treeCreationRateLimit = $appEnvironment === 'local' ? 30 : 5;

$giftStoragePath = trim((string) env('GIFT_PRIVATE_STORAGE_PATH', ''));
if ($giftStoragePath === '') {
    $giftStoragePath = dirname(__DIR__) . '/storage/private/gift-textures';
} elseif (preg_match('#^(?:[A-Za-z]:[\\\\/]|/)#', $giftStoragePath) !== 1) {
    $giftStoragePath = dirname(__DIR__) . '/' . ltrim(str_replace('\\', '/', $giftStoragePath), '/');
}
$memoryStoragePath = trim((string) env('MEMORY_STORAGE_PATH', ''));
if ($memoryStoragePath === '') {
    $memoryStoragePath = dirname(__DIR__) . '/storage/private/memories';
} elseif (preg_match('#^(?:[A-Za-z]:[\\\\/]|/)#', $memoryStoragePath) !== 1) {
    $memoryStoragePath = dirname(__DIR__) . '/' . ltrim(str_replace('\\', '/', $memoryStoragePath), '/');
}
$paymentEnvironment = (string) env('PAYMENTS_ENVIRONMENT', 'sandbox');
$paymentRequested = filter_var(env('PAYMENTS_ENABLED', false), FILTER_VALIDATE_BOOL);
$paymentProductionAllowed = filter_var(env('PAYMENTS_ALLOW_PRODUCTION', false), FILTER_VALIDATE_BOOL);
$paymentEnabled = $paymentRequested && ($paymentEnvironment === 'sandbox' || (
    $paymentEnvironment === 'production' && $paymentProductionAllowed
    && $appEnvironment === 'production'
    && str_starts_with((string) env('APP_URL', ''), 'https://')
));

return [
    'name' => (string) env('APP_NAME', 'Christmas Tree'),
    'environment' => $appEnvironment,
    'debug' => (bool) env('APP_DEBUG', false),
    'url' => (string) env('APP_URL', 'http://localhost'),
    'port' => (int) env('APP_PORT', 0),
    'timezone' => (string) env('APP_TIMEZONE', 'UTC'),
    'session' => [
        'name' => (string) env('SESSION_NAME', 'christmas_tree_session'),
        'secure' => (bool) env('SESSION_SECURE', false),
        'lifetime_seconds' => max(900, (int) env('SESSION_LIFETIME_SECONDS', 7200)),
    ],
    'persistent_access' => [
        'cookie_name' => (string) env('TREE_ACCESS_COOKIE_NAME', 'christmas_tree_access'),
        'lifetime_days' => (int) env('TREE_ACCESS_LIFETIME_DAYS', 90),
    ],
    'visitor_identity' => [
        'cookie_name' => (string) env('VISITOR_IDENTITY_COOKIE_NAME', 'christmas_tree_visitor'),
        'lifetime_days' => max(1, (int) env('VISITOR_IDENTITY_LIFETIME_DAYS', 90)),
    ],
    'ornaments' => [
        'capacity' => (int) env('ORNAMENT_MAX_PER_TREE', 60),
    ],
    'memories' => [
        'storage_path' => $memoryStoragePath,
        'capacity' => 6,
        'max_input_bytes' => (int) env('MEMORY_MAX_INPUT_BYTES', 8388608),
        'max_request_bytes' => (int) env('MEMORY_MAX_REQUEST_BYTES', 8650752),
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
    'payments' => [
        'enabled' => $paymentEnabled,
        'provider' => (string) env('PAYMENTS_PROVIDER', 'mercadopago'),
        'environment' => $paymentEnvironment,
        'access_token' => trim((string) env('MERCADOPAGO_ACCESS_TOKEN', '')),
        'webhook_secret' => trim((string) env('MERCADOPAGO_WEBHOOK_SECRET', '')),
        'expiration_minutes' => (int) env('PAYMENTS_PIX_EXPIRATION_MINUTES', 1440),
        'reconciliation_batch_size' => (int) env('PAYMENTS_RECONCILIATION_BATCH_SIZE', 20),
        'catalog_version' => (string) env('GIFT_PRICE_VERSION', '2026-11'),
        'prices' => [
            'special' => (int) env('GIFT_PRICE_SPECIAL_CENTS', 199),
            'personalized' => (int) env('GIFT_PRICE_PERSONALIZED_CENTS', 399),
            'magic' => (int) env('GIFT_PRICE_MAGIC_CENTS', 599),
        ],
    ],
    'rate_limits' => [
        'tree_creation' => [
            'max_attempts' => (int) env('TREE_CREATE_RATE_LIMIT', $treeCreationRateLimit),
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
        'memory_mutation' => [
            'max_attempts' => (int) env('MEMORY_MUTATION_RATE_LIMIT', 20),
            'window_seconds' => (int) env('MEMORY_MUTATION_RATE_WINDOW', 900),
        ],
        'gift_draft_creation' => [
            'max_attempts' => (int) env('GIFT_DRAFT_RATE_LIMIT', 6),
            'window_seconds' => (int) env('GIFT_DRAFT_RATE_WINDOW', 900),
        ],
        'gift_payment_creation' => [
            'max_attempts' => (int) env('GIFT_PAYMENT_RATE_LIMIT', 5),
            'window_seconds' => (int) env('GIFT_PAYMENT_RATE_WINDOW', 900),
        ],
    ],
];

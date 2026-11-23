<?php

declare(strict_types=1);

use App\Core\Database;
use Dotenv\Dotenv;

$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
Dotenv::createImmutable($root)->safeLoad();

$config = require $root . '/config/app.php';
$databaseConfig = require $root . '/config/database.php';
$requested = filter_var($_ENV['PAYMENTS_ENABLED'] ?? false, FILTER_VALIDATE_BOOL);
$productionAllowed = filter_var($_ENV['PAYMENTS_ALLOW_PRODUCTION'] ?? false, FILTER_VALIDATE_BOOL);
$previewEnabled = filter_var($_ENV['VITE_ENABLE_GIFT_PREVIEW'] ?? false, FILTER_VALIDATE_BOOL);
$accessTokenConfigured = $config['payments']['access_token'] !== '';
$webhookSecretConfigured = $config['payments']['webhook_secret'] !== '';
$gatewayAvailable = $config['payments']['enabled']
    && $config['payments']['provider'] === 'mercadopago'
    && $accessTokenConfigured
    && $webhookSecretConfigured;

$status = [
    'app_environment' => $config['environment'],
    'app_url_scheme' => parse_url($config['url'], PHP_URL_SCHEME) ?: 'unknown',
    'app_port' => $config['port'],
    'gift_preview_enabled' => $previewEnabled,
    'payments_requested' => $requested,
    'payments_feature_gate' => $config['payments']['enabled'],
    'payment_gateway_available' => $gatewayAvailable,
    'payments_provider' => $config['payments']['provider'],
    'payments_environment' => $config['payments']['environment'],
    'payments_allow_production' => $productionAllowed,
    'access_token' => $accessTokenConfigured ? 'configured' : 'missing',
    'webhook_secret' => $webhookSecretConfigured ? 'configured' : 'missing',
    'database' => (string) ($databaseConfig['database'] ?? ''),
];

try {
    $pdo = (new Database($databaseConfig))->connection();
    $statement = $pdo->query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() "
        . "AND table_name IN ('christmas_tree_gift_orders', 'christmas_tree_payment_events')"
    );
    $status['database_connection'] = 'ok';
    $status['payment_tables'] = (int) $statement->fetchColumn();
    $status['local_order_count'] = (int) $pdo->query('SELECT COUNT(*) FROM christmas_tree_gift_orders')->fetchColumn();
} catch (Throwable $exception) {
    $status['database_connection'] = 'failed:' . get_class($exception);
}

echo json_encode($status, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
exit(($status['database_connection'] ?? '') === 'ok' ? 0 : 1);

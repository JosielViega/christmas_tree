<?php

declare(strict_types=1);

use App\Core\Database;
use App\Repositories\PdoChristmasTreeGiftRepository;
use App\Repositories\PdoChristmasTreeRepository;
use App\Repositories\PdoPaymentOrderRepository;
use App\Payments\CurlPaymentHttpClient;
use App\Payments\MercadoPagoPaymentGateway;
use App\Services\ChristmasTreeGiftService;
use App\Services\GiftPaymentService;
use App\Services\GiftProductCatalog;
use App\Services\GiftTextureStorage;
use Dotenv\Dotenv;

$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
Dotenv::createImmutable($root)->safeLoad();
$appConfig = require $root . '/config/app.php';
$database = new Database(require $root . '/config/database.php');
$service = new ChristmasTreeGiftService(
    new PdoChristmasTreeRepository($database),
    new PdoChristmasTreeGiftRepository($database),
    new GiftTextureStorage($appConfig['gifts']['private_storage_path'], $appConfig['gifts']['max_texture_bytes']),
    $appConfig['gifts']['draft_expiration_hours'],
);
$paymentGateway = new MercadoPagoPaymentGateway(
    new CurlPaymentHttpClient(),
    $appConfig['payments']['access_token'],
    $appConfig['payments']['webhook_secret'],
    $appConfig['payments']['environment'] === 'sandbox',
    $appConfig['payments']['enabled'] && $appConfig['payments']['provider'] === 'mercadopago',
);
$payments = new GiftPaymentService(
    $service,
    new PdoPaymentOrderRepository($database),
    new GiftProductCatalog($appConfig['payments']['prices'], $appConfig['payments']['catalog_version']),
    $paymentGateway,
    $appConfig['payments']['expiration_minutes'],
    $appConfig['payments']['environment'] === 'production',
);

try {
    $reconciled = $payments->reconcilePending($appConfig['payments']['reconciliation_batch_size']);
    $cleaned = $service->cleanupExpired($appConfig['gifts']['cleanup_batch_size']);
    fwrite(STDOUT, "Payment orders reconciled: {$reconciled}; gift drafts cleaned: {$cleaned}" . PHP_EOL);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Gift draft cleanup failed: ' . get_class($exception) . PHP_EOL);
    exit(1);
}

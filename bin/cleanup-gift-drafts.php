<?php

declare(strict_types=1);

use App\Core\Database;
use App\Repositories\PdoChristmasTreeGiftRepository;
use App\Repositories\PdoChristmasTreeRepository;
use App\Repositories\PdoPaymentOrderRepository;
use App\Repositories\PdoGiftPublicationRepository;
use App\Payments\CurlPaymentHttpClient;
use App\Payments\MercadoPagoPaymentGateway;
use App\Services\ChristmasTreeGiftService;
use App\Services\GiftPaymentService;
use App\Services\GiftProductCatalog;
use App\Services\GiftPublicationService;
use App\Services\GiftTextureStorage;
use App\Console\ProcessLock;
use Dotenv\Dotenv;

$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
require $root . '/bin/lib/ProcessLock.php';
Dotenv::createImmutable($root)->safeLoad();
$appConfig = require $root . '/config/app.php';
$lock = new ProcessLock(rtrim($appConfig['storage']['cache_path'], '/\\') . '/locks/gifts-cleanup.lock');
if (!$lock->acquire()) {
    fwrite(STDOUT, 'Gift maintenance already running; this invocation was skipped.' . PHP_EOL);
    exit(0);
}
$database = new Database(require $root . '/config/database.php');
$treeRepository = new PdoChristmasTreeRepository($database);
$giftRepository = new PdoChristmasTreeGiftRepository($database);
$giftStorage = new GiftTextureStorage($appConfig['gifts']['private_storage_path'], $appConfig['gifts']['max_texture_bytes']);
$service = new ChristmasTreeGiftService(
    $treeRepository,
    $giftRepository,
    $giftStorage,
    $appConfig['gifts']['draft_expiration_hours'],
);
$publication = new GiftPublicationService(
    $treeRepository, $giftRepository, new PdoGiftPublicationRepository($database), $giftStorage,
    $appConfig['messages']['reveal_at'], $appConfig['messages']['reveal_timezone'],
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
    null,
    $publication,
);

try {
    $reconciled = $payments->reconcilePending($appConfig['payments']['reconciliation_batch_size']);
    $published = $publication->publishEligible($appConfig['payments']['reconciliation_batch_size']);
    $cleaned = $service->cleanupExpired($appConfig['gifts']['cleanup_batch_size']);
    fwrite(STDOUT, "Payment orders reconciled: {$reconciled}; gifts published: {$published}; gift drafts cleaned: {$cleaned}" . PHP_EOL);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Gift draft cleanup failed: ' . get_class($exception) . PHP_EOL);
    exit(1);
}

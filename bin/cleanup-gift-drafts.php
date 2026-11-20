<?php

declare(strict_types=1);

use App\Core\Database;
use App\Repositories\PdoChristmasTreeGiftRepository;
use App\Repositories\PdoChristmasTreeRepository;
use App\Services\ChristmasTreeGiftService;
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

try {
    $cleaned = $service->cleanupExpired($appConfig['gifts']['cleanup_batch_size']);
    fwrite(STDOUT, "Gift drafts cleaned: {$cleaned}" . PHP_EOL);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Gift draft cleanup failed: ' . get_class($exception) . PHP_EOL);
    exit(1);
}

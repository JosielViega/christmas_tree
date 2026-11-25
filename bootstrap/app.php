<?php

declare(strict_types=1);

use App\Core\Csrf;
use App\Core\Database;
use App\Core\ErrorHandler;
use App\Core\FrontendAssets;
use App\Core\Logger;
use App\Core\Request;
use App\Core\Router;
use App\Core\Session;
use App\Core\View;
use App\Validation\Validator;
use Dotenv\Dotenv;

$root = dirname(__DIR__);
$autoload = $root . '/vendor/autoload.php';

if (!is_file($autoload)) {
    http_response_code(500);
    exit('Dependencies are missing. Run composer install.');
}

require $autoload;

Dotenv::createImmutable($root)->safeLoad();

$appConfig = require $root . '/config/app.php';
$databaseConfig = require $root . '/config/database.php';
$logger = new Logger($appConfig['storage']['log_path']);
(new ErrorHandler($logger, $appConfig['debug']))->register();

date_default_timezone_set($appConfig['timezone']);

$httpsActive = str_starts_with(strtolower($appConfig['url']), 'https://')
    || (($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off');

$session = new Session();
$session->start([
    'name' => $appConfig['session']['name'],
    'cookie_httponly' => true,
    'cookie_secure' => $appConfig['session']['secure'] || $httpsActive,
    'cookie_samesite' => 'Lax',
    'cookie_path' => '/',
    'cookie_lifetime' => 0,
    'gc_maxlifetime' => $appConfig['session']['lifetime_seconds'],
    'use_strict_mode' => true,
    'use_only_cookies' => true,
]);

return [
    'config' => $appConfig,
    'request' => Request::capture(),
    'router' => new Router(),
    'view' => new View($root . '/resources/views'),
    'frontendAssets' => new FrontendAssets($root . '/public/assets/app/.vite/manifest.json'),
    'session' => $session,
    'csrf' => new Csrf($session),
    'validator' => new Validator(),
    'database' => new Database($databaseConfig),
    'logger' => $logger,
];

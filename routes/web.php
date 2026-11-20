<?php

declare(strict_types=1);

use App\Controllers\HealthController;
use App\Controllers\HomeController;
use App\Controllers\GiftDraftApiController;
use App\Controllers\GiftPaymentApiController;
use App\Controllers\TreeApiController;
use App\Controllers\TreePageController;
use App\Controllers\TreeOrnamentApiController;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\PdoChristmasTreeRepository;
use App\Repositories\PdoChristmasTreeOrnamentRepository;
use App\Repositories\PdoChristmasTreeGiftRepository;
use App\Repositories\PdoPaymentOrderRepository;
use App\Payments\CurlPaymentHttpClient;
use App\Payments\MercadoPagoPaymentGateway;
use App\Services\ChristmasTreeGiftService;
use App\Services\ChristmasTreeOrnamentService;
use App\Services\ChristmasTreeIdentityService;
use App\Services\RateLimiter;
use App\Services\GiftDraftAccessSession;
use App\Services\GiftTextureStorage;
use App\Services\GiftPaymentService;
use App\Services\GiftProductCatalog;
use App\Services\TreeOwnerSession;

$home = new HomeController(
    $app['request'],
    $app['view'],
    $app['session'],
    $app['csrf'],
    $app['validator'],
    $app['config'],
    $app['frontendAssets'],
);
$health = new HealthController();
$treeRepository = new PdoChristmasTreeRepository($app['database']);
$treeIdentity = new ChristmasTreeIdentityService($treeRepository);
$treeOwnerSession = new TreeOwnerSession($app['session']);
$rateLimitPath = dirname(__DIR__) . '/storage/cache/rate-limits';
$treeApi = new TreeApiController(
    $app['request'],
    $app['csrf'],
    $treeIdentity,
    $treeOwnerSession,
    new RateLimiter(
        $rateLimitPath . '/creation',
        $app['config']['rate_limits']['tree_creation']['max_attempts'],
        $app['config']['rate_limits']['tree_creation']['window_seconds'],
    ),
    new RateLimiter(
        $rateLimitPath . '/recovery',
        $app['config']['rate_limits']['tree_recovery']['max_attempts'],
        $app['config']['rate_limits']['tree_recovery']['window_seconds'],
    ),
    $app['config'],
);
$treePage = new TreePageController(
    $app['view'],
    $app['frontendAssets'],
    $app['csrf'],
    $treeIdentity,
    $treeOwnerSession,
    $app['config'],
);
$ornamentService = new ChristmasTreeOrnamentService(
    $treeRepository,
    new PdoChristmasTreeOrnamentRepository($app['database']),
    $app['config']['ornaments']['capacity'],
    $app['config']['messages']['reveal_at'],
    $app['config']['messages']['reveal_timezone'],
);
$ornamentApi = new TreeOrnamentApiController(
    $app['request'],
    $app['csrf'],
    $treeIdentity,
    $ornamentService,
    $treeOwnerSession,
    new RateLimiter(
        $rateLimitPath . '/ornaments',
        $app['config']['rate_limits']['ornament_creation']['max_attempts'],
        $app['config']['rate_limits']['ornament_creation']['window_seconds'],
    ),
);
$giftService = new ChristmasTreeGiftService(
    $treeRepository,
    new PdoChristmasTreeGiftRepository($app['database']),
    new GiftTextureStorage(
        $app['config']['gifts']['private_storage_path'],
        $app['config']['gifts']['max_texture_bytes'],
    ),
    $app['config']['gifts']['draft_expiration_hours'],
);
$giftAccessSession = new GiftDraftAccessSession($app['session']);
$giftApi = new GiftDraftApiController(
    $app['request'],
    $app['csrf'],
    $giftService,
    $giftAccessSession,
    new RateLimiter(
        $rateLimitPath . '/gift-drafts',
        $app['config']['rate_limits']['gift_draft_creation']['max_attempts'],
        $app['config']['rate_limits']['gift_draft_creation']['window_seconds'],
    ),
    $app['config']['gifts']['max_request_bytes'],
);
$paymentCatalog = new GiftProductCatalog(
    $app['config']['payments']['prices'],
    $app['config']['payments']['catalog_version'],
);
$paymentGateway = new MercadoPagoPaymentGateway(
    new CurlPaymentHttpClient(),
    $app['config']['payments']['access_token'],
    $app['config']['payments']['webhook_secret'],
    $app['config']['payments']['environment'] === 'sandbox',
    $app['config']['payments']['enabled'] && $app['config']['payments']['provider'] === 'mercadopago',
);
$paymentService = new GiftPaymentService(
    $giftService,
    new PdoPaymentOrderRepository($app['database']),
    $paymentCatalog,
    $paymentGateway,
    $app['config']['payments']['expiration_minutes'],
    $app['config']['payments']['environment'] === 'production',
);
$paymentApi = new GiftPaymentApiController(
    $app['request'], $app['csrf'], $paymentService, $paymentCatalog, $giftAccessSession,
    new RateLimiter(
        $rateLimitPath . '/gift-payments',
        $app['config']['rate_limits']['gift_payment_creation']['max_attempts'],
        $app['config']['rate_limits']['gift_payment_creation']['window_seconds'],
    ),
);
$router = $app['router'];

$router->get('/', [$home, 'index']);
$router->get('/t/{public_id}', [$treePage, 'show']);
$router->get('/credits', [$home, 'credits']);
$router->post('/example', [$home, 'submitExample']);
$router->get('/health', [$health, 'index']);
$router->get('/api/context', [$treeApi, 'context']);
$router->post('/api/trees', [$treeApi, 'create']);
$router->get('/api/trees/{public_id}', [$treeApi, 'show']);
$router->get('/api/trees/{public_id}/admin', [$treeApi, 'admin']);
$router->post('/api/trees/{public_id}/recover', [$treeApi, 'recover']);
$router->get('/api/trees/{public_id}/ornaments', [$ornamentApi, 'index']);
$router->post('/api/trees/{public_id}/ornaments', [$ornamentApi, 'store']);
$router->get('/api/trees/{public_id}/messages', [$ornamentApi, 'messages']);
$router->delete('/api/trees/{public_id}/ornaments/{ornament_id}', [$ornamentApi, 'destroy']);
$router->post('/api/trees/{public_id}/gift-drafts', [$giftApi, 'store']);
$router->get('/api/gift-drafts/{gift_id}', [$giftApi, 'show']);
$router->delete('/api/gift-drafts/{gift_id}', [$giftApi, 'destroy']);
$router->get('/api/payments/catalog', [$paymentApi, 'catalog']);
$router->post('/api/gift-drafts/{gift_id}/order', [$paymentApi, 'store']);
$router->get('/api/gift-drafts/{gift_id}/order', [$paymentApi, 'show']);
$router->post('/api/payments/webhook/mercadopago', [$paymentApi, 'webhook']);
$router->fallback(static function (Request $request) use ($app): Response {
    return Response::html($app['view']->render('pages/404', [
        'title' => 'Page not found',
        'path' => $request->path(),
    ]), 404);
});

return $router;

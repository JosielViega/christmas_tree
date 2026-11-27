<?php

declare(strict_types=1);

use App\Controllers\HealthController;
use App\Controllers\HomeController;
use App\Controllers\GiftDraftApiController;
use App\Controllers\GiftPaymentApiController;
use App\Controllers\TreeGiftApiController;
use App\Controllers\TreeApiController;
use App\Controllers\TreePageController;
use App\Controllers\TreeOrnamentApiController;
use App\Controllers\TreeMemoryApiController;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\PdoChristmasTreeRepository;
use App\Repositories\PdoChristmasTreeOrnamentRepository;
use App\Repositories\PdoChristmasTreeGiftRepository;
use App\Repositories\PdoPaymentOrderRepository;
use App\Repositories\PdoGiftPublicationRepository;
use App\Repositories\PdoPersistentTreeCredentialRepository;
use App\Repositories\PdoChristmasTreeMemoryRepository;
use App\Repositories\PdoVisitorIdentityRepository;
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
use App\Services\GiftPublicationService;
use App\Services\TreeOwnerSession;
use App\Services\PersistentTreeAccessService;
use App\Services\ChristmasTreeMemoryService;
use App\Services\MemoryImageStorage;
use App\Services\VisitorIdentityService;
use App\Services\MessageReleasePolicy;

$health = new HealthController();
$treeRepository = new PdoChristmasTreeRepository($app['database']);
$treeIdentity = new ChristmasTreeIdentityService($treeRepository);
$treeOwnerSession = new TreeOwnerSession($app['session']);
$persistentAccess = new PersistentTreeAccessService(
    new PdoPersistentTreeCredentialRepository($app['database']),
    $treeOwnerSession,
    $app['config']['persistent_access']['cookie_name'],
    $app['config']['persistent_access']['lifetime_days'],
    $app['config']['session']['secure'] || $app['request']->isSecure() || str_starts_with(strtolower($app['config']['url']), 'https://'),
);
$persistentCookie = $app['request']->cookie($persistentAccess->cookieName);
$persistentAccess->restore(is_string($persistentCookie) ? $persistentCookie : null);
$home = new HomeController(
    $app['request'], $app['view'], $app['session'], $app['csrf'], $app['validator'], $app['config'],
    $app['frontendAssets'], $treeIdentity, $treeOwnerSession, $persistentAccess,
);
$rateLimitPath = rtrim($app['config']['storage']['cache_path'], '/\\') . '/rate-limits';
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
    $persistentAccess,
);
$treePage = new TreePageController(
    $app['view'],
    $app['frontendAssets'],
    $app['csrf'],
    $treeIdentity,
    $treeOwnerSession,
    $app['config'],
    $persistentAccess,
);
$messageRelease = new MessageReleasePolicy(
    $app['config']['messages']['reveal_at'],
    $app['config']['messages']['reveal_timezone'],
    $app['config']['messages']['manual_release'],
);
$ornamentService = new ChristmasTreeOrnamentService(
    $treeRepository,
    new PdoChristmasTreeOrnamentRepository($app['database']),
    $app['config']['ornaments']['capacity'],
    $app['config']['messages']['reveal_at'],
    $app['config']['messages']['reveal_timezone'],
    null,
    $messageRelease,
);
$visitorIdentity = new VisitorIdentityService(
    new PdoVisitorIdentityRepository($app['database']),
    $app['config']['visitor_identity']['cookie_name'],
    $app['config']['visitor_identity']['lifetime_days'],
    $app['config']['session']['secure'] || $app['request']->isSecure() || str_starts_with(strtolower($app['config']['url']), 'https://'),
);
$ornamentApi = new TreeOrnamentApiController(
    $app['request'],
    $app['csrf'],
    $treeIdentity,
    $ornamentService,
    $treeOwnerSession,
    $visitorIdentity,
    new RateLimiter(
        $rateLimitPath . '/ornaments',
        $app['config']['rate_limits']['ornament_creation']['max_attempts'],
        $app['config']['rate_limits']['ornament_creation']['window_seconds'],
    ),
);
$memoryService = new ChristmasTreeMemoryService(
    $treeIdentity,
    new PdoChristmasTreeMemoryRepository($app['database']),
    new MemoryImageStorage($app['config']['memories']['storage_path'], $app['config']['memories']['max_input_bytes']),
    $app['config']['memories']['capacity'],
);
$memoryApi = new TreeMemoryApiController(
    $app['request'], $app['csrf'], $treeIdentity, $memoryService, $treeOwnerSession,
    new RateLimiter(
        $rateLimitPath . '/memories',
        $app['config']['rate_limits']['memory_mutation']['max_attempts'],
        $app['config']['rate_limits']['memory_mutation']['window_seconds'],
    ),
    $app['config']['memories']['max_request_bytes'],
    $app['config']['memories']['capacity'],
);
$giftRepository = new PdoChristmasTreeGiftRepository($app['database']);
$giftStorage = new GiftTextureStorage(
    $app['config']['gifts']['private_storage_path'],
    $app['config']['gifts']['max_texture_bytes'],
);
$giftService = new ChristmasTreeGiftService(
    $treeRepository,
    $giftRepository,
    $giftStorage,
    $app['config']['gifts']['draft_expiration_hours'],
);
$giftPublication = new GiftPublicationService(
    $treeRepository,
    $giftRepository,
    new PdoGiftPublicationRepository($app['database']),
    $giftStorage,
    $app['config']['messages']['reveal_at'],
    $app['config']['messages']['reveal_timezone'],
    null,
    $messageRelease,
);
$giftAccessSession = new GiftDraftAccessSession($app['session']);
$giftApi = new GiftDraftApiController(
    $app['request'],
    $app['csrf'],
    $giftService,
    $treeIdentity,
    $treeOwnerSession,
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
    $app['config']['payments']['sandbox_apro'],
);
$paymentService = new GiftPaymentService(
    $giftService,
    new PdoPaymentOrderRepository($app['database']),
    $paymentCatalog,
    $paymentGateway,
    $app['config']['payments']['expiration_minutes'],
    $app['config']['payments']['environment'] === 'production',
    null,
    $giftPublication,
);
$paymentApi = new GiftPaymentApiController(
    $app['request'], $app['csrf'], $paymentService, $paymentCatalog, $treeIdentity, $treeOwnerSession, $giftAccessSession,
    new RateLimiter(
        $rateLimitPath . '/gift-payments',
        $app['config']['rate_limits']['gift_payment_creation']['max_attempts'],
        $app['config']['rate_limits']['gift_payment_creation']['window_seconds'],
    ),
    technicalSandbox: (bool) $app['config']['payments']['sandbox_apro'],
);
$treeGiftApi = new TreeGiftApiController(
    $app['request'], $app['csrf'], $giftPublication, $treeIdentity, $treeOwnerSession,
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
$router->get('/api/trees/{public_id}/gifts', [$treeGiftApi, 'index']);
$router->get('/api/trees/{public_id}/memories', [$memoryApi, 'index']);
$router->post('/api/trees/{public_id}/memories', [$memoryApi, 'store']);
$router->post('/api/trees/{public_id}/memories/{memory_id}', [$memoryApi, 'update']);
$router->delete('/api/trees/{public_id}/memories/{memory_id}', [$memoryApi, 'destroy']);
$router->get('/api/trees/{public_id}/memories/{memory_id}/image', [$memoryApi, 'image']);
$router->post('/api/trees/{public_id}/ornaments', [$ornamentApi, 'store']);
$router->get('/api/trees/{public_id}/messages', [$ornamentApi, 'messages']);
$router->delete('/api/trees/{public_id}/ornaments/{ornament_id}', [$ornamentApi, 'destroy']);
$router->delete('/api/trees/{public_id}/gifts/{gift_id}', [$treeGiftApi, 'hide']);
$router->get('/api/trees/{public_id}/gifts/{gift_id}/message', [$treeGiftApi, 'message']);
$router->get('/api/gifts/{gift_id}/texture', [$treeGiftApi, 'texture']);
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

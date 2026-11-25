<?php

declare(strict_types=1);

namespace Tests;

use App\Controllers\GiftPaymentApiController;
use App\Core\Csrf;
use App\Core\Request;
use App\Core\Session;
use App\Domain\PaymentCharge;
use App\Domain\PaymentGatewayException;
use App\Services\ChristmasTreeGiftService;
use App\Services\GiftDraftAccessSession;
use App\Services\GiftPaymentService;
use App\Services\GiftProductCatalog;
use App\Services\GiftTextureStorage;
use App\Services\RateLimiter;
use PHPUnit\Framework\TestCase;
use Tests\Support\FakePaymentGateway;
use Tests\Support\InMemoryChristmasTreeGiftRepository;
use Tests\Support\InMemoryChristmasTreeRepository;
use Tests\Support\InMemoryPaymentOrderRepository;

final class GiftPaymentApiControllerTest extends TestCase
{
    private string $temporaryRoot;
    private Session $session;
    private Csrf $csrf;

    protected function setUp(): void
    {
        $_SESSION = [];
        $this->temporaryRoot = sys_get_temp_dir() . '/payment-api-' . bin2hex(random_bytes(5));
        $this->session = new Session(false);
        $this->csrf = new Csrf($this->session);
    }

    protected function tearDown(): void
    {
        if (!is_dir($this->temporaryRoot)) return;
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->temporaryRoot, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $item) $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        rmdir($this->temporaryRoot);
    }

    public function testCatalogAndDisabledCheckoutExposeNoCredentialsOrInternalErrors(): void
    {
        $gateway = new FakePaymentGateway();
        $gateway->available = false;
        $catalog = $this->controller(new Request(), $gateway)->catalog();
        self::assertSame(200, $catalog->status());
        self::assertStringContainsString('"available":false', $catalog->body());
        self::assertStringContainsString('"amount_cents":199', $catalog->body());
        self::assertStringContainsString('"technical_environment":false', $catalog->body());
        self::assertStringNotContainsString('access_token', $catalog->body());
        self::assertStringNotContainsString('webhook_secret', $catalog->body());

        $technicalCatalog = $this->controller(new Request(), $gateway, true)->catalog();
        self::assertStringContainsString('"technical_environment":true', $technicalCatalog->body());

        $request = new Request(
            parsedBody: ['product_code' => 'special', 'payer_email' => 'test@example.com'],
            server: [
                'REMOTE_ADDR' => '127.0.0.1', 'HTTP_X_CSRF_TOKEN' => $this->csrf->token(),
                'HTTP_X_GIFT_DRAFT_TOKEN' => str_repeat('t', 43), 'HTTP_IDEMPOTENCY_KEY' => str_repeat('i', 16),
            ],
        );
        $response = $this->controller($request, $gateway)->store('AbCdEfGh1234_-xy');
        self::assertSame(503, $response->status());
        self::assertStringContainsString('payments_unavailable', $response->body());
        self::assertStringNotContainsString('PaymentGatewayException', $response->body());
    }

    public function testWebhookRejectsWrongTopicOversizeAndInvalidSignature(): void
    {
        $gateway = new FakePaymentGateway();
        $gateway->signatureValid = false;
        $wrongTopic = new Request(queryParams: ['data.id' => 'ORD_TEST_123', 'type' => 'payment']);
        self::assertSame(400, $this->controller($wrongTopic, $gateway)->webhook()->status());

        $oversize = new Request(server: ['CONTENT_LENGTH' => 70000]);
        self::assertSame(413, $this->controller($oversize, $gateway)->webhook()->status());

        $invalid = new Request(
            queryParams: ['data.id' => 'ORD_TEST_123', 'type' => 'order'],
            server: ['HTTP_X_SIGNATURE' => 'bad', 'HTTP_X_REQUEST_ID' => 'request'],
            rawBody: '{"type":"order","data":{"id":"ORD_TEST_123"},"live_mode":false}',
        );
        self::assertSame(401, $this->controller($invalid, $gateway)->webhook()->status());
    }

    public function testWebhookAcknowledgesValidUnknownOrderAndReportsProviderFailure(): void
    {
        $gateway = new FakePaymentGateway();
        $gateway->charge = new PaymentCharge(
            'ORD_TEST_UNKNOWN', null, 'unknownlocalorder', 199, 'BRL', 'pending', false, null, null, null,
        );
        $request = new Request(
            queryParams: ['data.id' => 'ORD_TEST_UNKNOWN', 'type' => 'order'],
            server: ['HTTP_X_SIGNATURE' => 'signed', 'HTTP_X_REQUEST_ID' => 'request-123'],
            rawBody: '{"type":"order","data":{"id":"ORD_TEST_UNKNOWN"},"live_mode":false}',
        );

        $response = $this->controller($request, $gateway)->webhook();

        self::assertSame(200, $response->status());
        self::assertStringContainsString('"accepted":true', $response->body());
        self::assertSame(1, $gateway->fetchCalls);

        $gateway->fetchFailure = new PaymentGatewayException('Temporary provider failure.', true);
        $failure = $this->controller($request, $gateway)->webhook();
        self::assertSame(503, $failure->status());
        self::assertStringContainsString('provider_confirmation_failed', $failure->body());
        self::assertStringNotContainsString('Temporary provider failure', $failure->body());
    }

    private function controller(Request $request, FakePaymentGateway $gateway, bool $technicalSandbox = false): GiftPaymentApiController
    {
        $trees = new InMemoryChristmasTreeRepository();
        $gifts = new ChristmasTreeGiftService(
            $trees, new InMemoryChristmasTreeGiftRepository(), new GiftTextureStorage($this->temporaryRoot . '/private'),
        );
        $catalog = new GiftProductCatalog(['special' => 199, 'personalized' => 399, 'magic' => 599]);
        return new GiftPaymentApiController(
            $request, $this->csrf,
            new GiftPaymentService($gifts, new InMemoryPaymentOrderRepository(), $catalog, $gateway, 60, false),
            $catalog, new GiftDraftAccessSession($this->session),
            new RateLimiter($this->temporaryRoot . '/rates', 10, 900),
            technicalSandbox: $technicalSandbox,
        );
    }
}

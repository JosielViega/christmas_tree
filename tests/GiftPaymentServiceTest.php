<?php

declare(strict_types=1);

namespace Tests;

use App\Domain\PaymentCharge;
use App\Domain\PaymentGatewayException;
use App\Domain\PaymentValidationException;
use App\Services\ChristmasTreeGiftService;
use App\Services\ChristmasTreeIdentityService;
use App\Services\GiftPaymentService;
use App\Services\GiftProductCatalog;
use App\Services\GiftTextureStorage;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Tests\Support\FakePaymentGateway;
use Tests\Support\InMemoryChristmasTreeGiftRepository;
use Tests\Support\InMemoryChristmasTreeRepository;
use Tests\Support\InMemoryPaymentOrderRepository;

final class GiftPaymentServiceTest extends TestCase
{
    private string $storage;
    private DateTimeImmutable $now;
    private ChristmasTreeGiftService $gifts;
    private InMemoryPaymentOrderRepository $orders;
    private FakePaymentGateway $gateway;
    private string $giftId;
    private string $token;

    protected function setUp(): void
    {
        $this->storage = sys_get_temp_dir() . '/payment-service-' . bin2hex(random_bytes(5));
        $this->now = new DateTimeImmutable('2026-11-20T12:00:00Z');
        $trees = new InMemoryChristmasTreeRepository();
        $tree = (new ChristmasTreeIdentityService($trees))->create('Árvore Pix')->tree;
        $this->gifts = new ChristmasTreeGiftService(
            $trees, new InMemoryChristmasTreeGiftRepository(), new GiftTextureStorage($this->storage), 24,
            fn (): DateTimeImmutable => $this->now,
        );
        $upload = $this->upload();
        $gift = $this->gifts->create($tree->publicId, 'Ana', 'classic', 'repeated', 'Mensagem', str_repeat('g', 16), true, $upload);
        $this->giftId = $gift->gift->publicId;
        $this->token = (string) $gift->accessToken;
        unlink($upload['tmp_name']);
        $this->orders = new InMemoryPaymentOrderRepository();
        $this->gateway = new FakePaymentGateway();
    }

    protected function tearDown(): void
    {
        if (!is_dir($this->storage)) return;
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->storage, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $item) $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        rmdir($this->storage);
    }

    public function testCreatesServerPricedPixOrderAndRetriesWithoutDuplicateCharge(): void
    {
        $service = $this->service(['special' => 199, 'personalized' => 399, 'magic' => 599]);
        $first = $service->create($this->giftId, $this->token, 'personalized', 'buyer@example.com', str_repeat('p', 16));
        $repeat = $service->create($this->giftId, $this->token, 'personalized', 'buyer@example.com', str_repeat('p', 16));
        self::assertSame(399, $first?->amountCents);
        self::assertSame('BRL', $first?->currency);
        self::assertSame('pending', $first?->status);
        self::assertSame($first?->publicId, $repeat?->publicId);
        self::assertSame(1, $this->gateway->createCalls);

        $changedCatalog = $this->service(['special' => 299, 'personalized' => 999, 'magic' => 799]);
        $immutable = $changedCatalog->create($this->giftId, $this->token, 'personalized', 'buyer@example.com', str_repeat('p', 16));
        self::assertSame(399, $immutable?->amountCents);
        self::assertSame(1, $this->gateway->createCalls);
    }

    public function testRejectsInvalidTokenExpiredDraftEmailProductAndProviderMismatch(): void
    {
        $service = $this->service();
        self::assertNull($service->create($this->giftId, str_repeat('x', 43), 'special', 'buyer@example.com', str_repeat('a', 16)));
        try {
            $service->create($this->giftId, $this->token, 'unknown', 'invalid', 'short');
            self::fail('Validation should fail.');
        } catch (PaymentValidationException $exception) {
            self::assertArrayHasKey('product_code', $exception->errors);
            self::assertArrayHasKey('payer_email', $exception->errors);
            self::assertArrayHasKey('idempotency_key', $exception->errors);
        }
        $this->gateway->charge = new PaymentCharge('ORD_BAD_123', null, 'wrong-reference', 199, 'BRL', 'pending', false, null, null, null);
        $this->expectException(PaymentGatewayException::class);
        $service->create($this->giftId, $this->token, 'special', 'buyer@example.com', str_repeat('b', 16));
    }

    public function testSignedWebhookConfirmsOnceAndNeverPublishes(): void
    {
        $service = $this->service();
        $order = $service->create($this->giftId, $this->token, 'magic', 'buyer@example.com', str_repeat('c', 16));
        $this->gateway->charge = new PaymentCharge(
            (string) $order?->providerOrderId, 'PAY_PAID_123', (string) $order?->publicId, 599, 'BRL', 'paid', false, null, null, null,
        );
        self::assertTrue($service->processNotification('signature', 'request', (string) $order?->providerOrderId, '{"event":1}'));
        self::assertTrue($service->processNotification('signature', 'request', (string) $order?->providerOrderId, '{"event":1}'));
        self::assertSame('paid', $service->findAuthorized($this->giftId, $this->token)?->status);
        self::assertStringNotContainsString('publish', (string) file_get_contents(dirname(__DIR__) . '/routes/web.php'));
    }

    public function testDefinitiveProviderFailureReleasesDraftWhileTimeoutRemainsProtected(): void
    {
        $this->gateway->createFailure = new PaymentGatewayException('Rejected configuration.', false);
        try {
            $this->service()->create($this->giftId, $this->token, 'special', 'buyer@example.com', str_repeat('d', 16));
            self::fail('Provider failure should be propagated.');
        } catch (PaymentGatewayException) {
            self::assertSame('failed', array_values($this->orders->orders)[0]->status);
        }

        $this->orders = new InMemoryPaymentOrderRepository();
        $this->gateway = new FakePaymentGateway();
        $this->gateway->createFailure = new PaymentGatewayException('Timeout.', true);
        try {
            $this->service()->create($this->giftId, $this->token, 'special', 'buyer@example.com', str_repeat('e', 16));
            self::fail('Timeout should be propagated.');
        } catch (PaymentGatewayException) {
            self::assertSame('pending', array_values($this->orders->orders)[0]->status);
        }
    }

    private function service(array $prices = ['special' => 199, 'personalized' => 399, 'magic' => 599]): GiftPaymentService
    {
        return new GiftPaymentService(
            $this->gifts, $this->orders, new GiftProductCatalog($prices, 'v1'), $this->gateway, 60, false,
            fn (): DateTimeImmutable => $this->now,
        );
    }

    private function upload(): array
    {
        $path = tempnam(sys_get_temp_dir(), 'payment-png-');
        $image = imagecreatetruecolor(32, 32);
        imagepng($image, $path);
        return ['tmp_name' => $path, 'size' => filesize($path), 'error' => UPLOAD_ERR_OK, 'name' => 'texture.png', 'type' => 'image/png'];
    }
}

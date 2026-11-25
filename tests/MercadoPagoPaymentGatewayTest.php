<?php

declare(strict_types=1);

namespace Tests;

use App\Domain\PaymentChargeRequest;
use App\Domain\PaymentGatewayException;
use App\Payments\MercadoPagoPaymentGateway;
use App\Payments\PaymentHttpClient;
use App\Payments\PaymentHttpResponse;
use PHPUnit\Framework\TestCase;

final class MercadoPagoPaymentGatewayTest extends TestCase
{
    public function testCreatesPixOrderUsingDocumentedOrdersContractAndNormalizesPending(): void
    {
        $http = new class implements PaymentHttpClient {
            public string $body = '';
            public array $headers = [];
            public function request(string $method, string $url, array $headers, ?string $body = null): PaymentHttpResponse
            {
                \PHPUnit\Framework\Assert::assertSame('POST', $method);
                \PHPUnit\Framework\Assert::assertSame('https://api.mercadopago.com/v1/orders', $url);
                $this->headers = $headers; $this->body = (string) $body;
                return new PaymentHttpResponse(201, json_encode([
                    'id' => 'ORD_TEST_123', 'external_reference' => 'abcdefghijklmnop', 'total_amount' => '3.99',
                    'country_code' => 'BRA', 'status' => 'action_required', 'status_detail' => 'waiting_transfer',
                    'transactions' => ['payments' => [[
                        'id' => 'PAY_TEST_123', 'payment_method' => ['id' => 'pix', 'type' => 'bank_transfer', 'qr_code' => 'PIX-CODE'],
                    ]]],
                ], JSON_THROW_ON_ERROR));
            }
        };
        $gateway = new MercadoPagoPaymentGateway($http, 'TEST_TOKEN', 'secret', true, true);
        $charge = $gateway->createCharge(new PaymentChargeRequest('abcdefghijklmnop', 399, 'BRL', 'buyer@example.com', 'ct-abcdefghijklmnop', 60));
        $payload = json_decode($http->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('3.99', $payload['total_amount']);
        self::assertSame('online', $payload['type']);
        self::assertSame('abcdefghijklmnop', $payload['external_reference']);
        self::assertSame('automatic', $payload['processing_mode']);
        self::assertSame('3.99', $payload['transactions']['payments'][0]['amount']);
        self::assertSame('pix', $payload['transactions']['payments'][0]['payment_method']['id']);
        self::assertSame('bank_transfer', $payload['transactions']['payments'][0]['payment_method']['type']);
        self::assertSame('PT60M', $payload['transactions']['payments'][0]['expiration_time']);
        self::assertSame('buyer@example.com', $payload['payer']['email']);
        self::assertContains('Authorization: Bearer TEST_TOKEN', $http->headers);
        self::assertContains('X-Idempotency-Key: ct-abcdefghijklmnop', $http->headers);
        self::assertSame('pending', $charge->status);
        self::assertFalse($charge->liveMode);
    }

    public function testFetchesOfficialOrderAndNormalizesPaidStatus(): void
    {
        $http = new class implements PaymentHttpClient {
            public function request(string $method, string $url, array $headers, ?string $body = null): PaymentHttpResponse
            {
                \PHPUnit\Framework\Assert::assertSame('GET', $method);
                \PHPUnit\Framework\Assert::assertSame('https://api.mercadopago.com/v1/orders/ORD_TEST_456', $url);
                \PHPUnit\Framework\Assert::assertContains('Authorization: Bearer TEST_TOKEN', $headers);
                \PHPUnit\Framework\Assert::assertNull($body);
                return new PaymentHttpResponse(200, json_encode([
                    'id' => 'ORD_TEST_456', 'external_reference' => 'abcdefghijklmnop', 'total_amount' => '50.00',
                    'country_code' => 'BRA', 'status' => 'processed', 'status_detail' => 'accredited',
                    'transactions' => ['payments' => [['id' => 'PAY_TEST_456', 'payment_method' => ['id' => 'pix']]]],
                ], JSON_THROW_ON_ERROR));
            }
        };

        $charge = (new MercadoPagoPaymentGateway($http, 'TEST_TOKEN', 'secret', true, true))->fetchCharge('ORD_TEST_456');

        self::assertSame('paid', $charge->status);
        self::assertSame(5000, $charge->amountCents);
        self::assertSame('BRL', $charge->currency);
        self::assertFalse($charge->liveMode);
    }

    public function testAddsAproPayerOnlyForTheIsolatedFiftyRealSandboxScenario(): void
    {
        $http = new class implements PaymentHttpClient {
            public string $body = '';
            public function request(string $method, string $url, array $headers, ?string $body = null): PaymentHttpResponse
            {
                $this->body = (string) $body;
                return new PaymentHttpResponse(201, json_encode([
                    'id' => 'ORD_TEST_APRO', 'external_reference' => 'abcdefghijklmnop', 'total_amount' => '50.00',
                    'country_code' => 'BRA', 'status' => 'action_required', 'status_detail' => 'waiting_transfer',
                    'transactions' => ['payments' => [[
                        'id' => 'PAY_TEST_APRO', 'payment_method' => ['id' => 'pix', 'type' => 'bank_transfer'],
                    ]]],
                ], JSON_THROW_ON_ERROR));
            }
        };
        $request = new PaymentChargeRequest('abcdefghijklmnop', 5000, 'BRL', 'test_payer@example.com', 'ct-abcdefghijklmnop', 60);

        (new MercadoPagoPaymentGateway($http, 'TEST_TOKEN', 'secret', true, true, true))->createCharge($request);
        $payload = json_decode($http->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('APRO', $payload['payer']['first_name']);

        (new MercadoPagoPaymentGateway($http, 'TEST_TOKEN', 'secret', false, true, true))->createCharge($request);
        $payload = json_decode($http->body, true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayNotHasKey('first_name', $payload['payer']);
    }

    public function testVerifiesOfficialHmacManifestAndRejectsInvalidOrMalformedResponses(): void
    {
        $gateway = new MercadoPagoPaymentGateway(new class implements PaymentHttpClient {
            public function request(string $method, string $url, array $headers, ?string $body = null): PaymentHttpResponse { return new PaymentHttpResponse(200, '{}'); }
        }, 'token', 'webhook-secret', true, true);
        $manifest = 'id:ORD_TEST_123;request-id:req-123;ts:1742505638683;';
        $signature = 'ts=1742505638683,v1=' . hash_hmac('sha256', $manifest, 'webhook-secret');
        self::assertTrue($gateway->verifyNotification($signature, 'req-123', 'ORD_TEST_123'));
        self::assertFalse($gateway->verifyNotification($signature . '0', 'req-123', 'ORD_TEST_123'));
        self::assertFalse($gateway->verifyNotification('', 'req-123', 'ORD_TEST_123'));
        self::assertFalse($gateway->verifyNotification($signature, '', 'ORD_TEST_123'));
        self::assertFalse($gateway->verifyNotification($signature, 'req-123', 'ORD_TEST_OTHER'));
        $notification = $gateway->interpretNotification(json_encode([
            'type' => 'order', 'action' => 'order.updated', 'date_created' => '2026-11-23T12:00:00Z',
            'live_mode' => false, 'data' => ['id' => 'ORD_TEST_123', 'version' => '1'],
        ], JSON_THROW_ON_ERROR), 'ORD_TEST_123');
        self::assertNotNull($notification);
        self::assertFalse($notification->liveMode);
        self::assertNull($gateway->interpretNotification('{"type":"payment","live_mode":false,"data":{"id":"ORD_TEST_123"}}', 'ORD_TEST_123'));
        self::assertNull($gateway->interpretNotification('{}', 'ORD_TEST_123'));
        $this->expectException(PaymentGatewayException::class);
        $gateway->fetchCharge('ORD_TEST_123');
    }
}

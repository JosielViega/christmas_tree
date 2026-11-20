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
        self::assertSame('automatic', $payload['processing_mode']);
        self::assertSame('pix', $payload['transactions']['payments'][0]['payment_method']['id']);
        self::assertSame('buyer@example.com', $payload['payer']['email']);
        self::assertContains('X-Idempotency-Key: ct-abcdefghijklmnop', $http->headers);
        self::assertSame('pending', $charge->status);
        self::assertFalse($charge->liveMode);
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
        self::assertNull($gateway->interpretNotification('{}', 'ORD_TEST_123'));
        $this->expectException(PaymentGatewayException::class);
        $gateway->fetchCharge('ORD_TEST_123');
    }
}

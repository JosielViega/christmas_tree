<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

final class WebhookOnlyRouterTest extends TestCase
{
    public function testDedicatedIngressAllowsOnlyTheExactWebhookPost(): void
    {
        $source = file_get_contents(dirname(__DIR__) . '/bin/webhook-only-router.php');

        self::assertIsString($source);
        self::assertStringContainsString("const MERCADOPAGO_WEBHOOK_PATH = '/api/payments/webhook/mercadopago';", $source);
        self::assertStringContainsString('$path !== MERCADOPAGO_WEBHOOK_PATH', $source);
        self::assertStringContainsString('$method !== \'POST\'', $source);
        self::assertStringContainsString("header('Allow: POST')", $source);
        self::assertStringContainsString("require dirname(__DIR__) . '/public/index.php';", $source);
    }
}

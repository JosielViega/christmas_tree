<?php

declare(strict_types=1);

namespace App\Payments;

interface PaymentHttpClient
{
    /** @param list<string> $headers */
    public function request(string $method, string $url, array $headers, ?string $body = null): PaymentHttpResponse;
}

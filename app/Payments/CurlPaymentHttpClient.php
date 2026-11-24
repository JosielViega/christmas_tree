<?php

declare(strict_types=1);

namespace App\Payments;

use App\Domain\PaymentGatewayException;

final class CurlPaymentHttpClient implements PaymentHttpClient
{
    public function __construct(private readonly int $connectTimeout = 5, private readonly int $timeout = 12)
    {
    }

    public function request(string $method, string $url, array $headers, ?string $body = null): PaymentHttpResponse
    {
        if (!extension_loaded('curl')) {
            throw new PaymentGatewayException('The cURL extension is required for payments.', false);
        }
        $handle = curl_init($url);
        if ($handle === false) throw new PaymentGatewayException('Unable to initialize the payment connection.');
        $responseBody = '';
        curl_setopt_array($handle, [
            CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers, CURLOPT_RETURNTRANSFER => false,
            CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => $this->connectTimeout, CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$responseBody): int {
                $responseBody .= $chunk;
                if (strlen($responseBody) > 2097152) return 0;
                return strlen($chunk);
            },
        ]);
        if ($body !== null) curl_setopt($handle, CURLOPT_POSTFIELDS, $body);
        $ok = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        // CurlHandle resources are released automatically. Calling curl_close()
        // is deprecated on PHP 8.5 and the application error handler promotes
        // that deprecation to an exception after a successful HTTP exchange.
        unset($handle);
        if ($ok === false) throw new PaymentGatewayException('Payment provider connection failed: ' . ($error === '' ? 'transport error' : 'transport error'));
        return new PaymentHttpResponse($status, $responseBody);
    }
}

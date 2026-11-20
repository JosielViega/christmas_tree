<?php

declare(strict_types=1);

namespace App\Payments;

final readonly class PaymentHttpResponse
{
    public function __construct(public int $status, public string $body)
    {
    }
}

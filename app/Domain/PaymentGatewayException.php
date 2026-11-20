<?php

declare(strict_types=1);

namespace App\Domain;

use RuntimeException;

final class PaymentGatewayException extends RuntimeException
{
    public function __construct(string $message, public readonly bool $retryable = true)
    {
        parent::__construct($message);
    }
}

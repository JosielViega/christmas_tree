<?php

declare(strict_types=1);

namespace App\Domain;

use RuntimeException;

final class PaymentValidationException extends RuntimeException
{
    /** @param array<string, list<string>> $errors */
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Payment request validation failed.');
    }
}

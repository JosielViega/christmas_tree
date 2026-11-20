<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class PaymentOrderPersistence
{
    public function __construct(public PaymentOrder $order, public bool $created)
    {
    }
}

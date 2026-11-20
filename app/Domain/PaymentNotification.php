<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class PaymentNotification
{
    public function __construct(public string $resourceId, public string $eventKey, public string $eventType, public bool $liveMode)
    {
    }
}

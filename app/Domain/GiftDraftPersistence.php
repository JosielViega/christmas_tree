<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class GiftDraftPersistence
{
    public function __construct(public GiftDraftRecord $record, public bool $created)
    {
    }
}

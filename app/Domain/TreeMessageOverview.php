<?php

declare(strict_types=1);

namespace App\Domain;

final readonly class TreeMessageOverview
{
    /** @param list<PrivateTreeMessage> $messages */
    public function __construct(
        public int $messageCount,
        public bool $revealed,
        public string $revealAt,
        public array $messages,
    ) {
    }
}

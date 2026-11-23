<?php

declare(strict_types=1);

namespace App\Services;

use Closure;
use DateTimeImmutable;
use DateTimeZone;

final class MessageReleasePolicy
{
    private readonly Closure $clock;
    private readonly DateTimeImmutable $revealAt;

    public function __construct(
        string $revealAt = '2026-12-25 00:00:00',
        string $revealTimezone = 'America/Sao_Paulo',
        private readonly bool $manualReleaseEnabled = false,
        ?callable $clock = null,
    ) {
        $this->revealAt = new DateTimeImmutable($revealAt, new DateTimeZone($revealTimezone));
        $this->clock = $clock === null
            ? static fn (): DateTimeImmutable => new DateTimeImmutable('now', new DateTimeZone('UTC'))
            : Closure::fromCallable($clock);
    }

    public static function parseManualRelease(mixed $value): bool
    {
        if (is_bool($value)) return $value;
        return is_string($value) && strtolower(trim($value)) === 'true';
    }

    public function messagesReleased(): bool
    {
        return $this->manualReleaseEnabled || ($this->clock)() >= $this->revealAt;
    }

    public function revealAtUtc(): string
    {
        return $this->revealAt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
    }
}

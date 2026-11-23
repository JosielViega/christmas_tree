<?php

declare(strict_types=1);

namespace Tests;

use App\Services\MessageReleasePolicy;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class MessageReleasePolicyTest extends TestCase
{
    public static function environmentValues(): array
    {
        return [
            'missing' => [null, false],
            'boolean false' => [false, false],
            'string false' => ['false', false],
            'zero' => ['0', false],
            'boolean true' => [true, true],
            'string true' => ['true', true],
            'uppercase true' => ['TRUE', true],
            'invalid text' => ['enabled', false],
            'filter-style yes remains invalid' => ['yes', false],
            'filter-style on remains invalid' => ['on', false],
            'numeric one remains invalid' => ['1', false],
            'invalid number' => ['2', false],
            'empty' => ['', false],
        ];
    }

    #[DataProvider('environmentValues')]
    public function testManualReleaseUsesStrictSafeBooleanParsing(mixed $value, bool $expected): void
    {
        self::assertSame($expected, MessageReleasePolicy::parseManualRelease($value));
    }

    public function testAutomaticBoundaryAndManualOverrideUseOnlyControlledServerClock(): void
    {
        $at = static fn (string $instant, bool $manual = false): MessageReleasePolicy => new MessageReleasePolicy(
            '2026-12-25 00:00:00',
            'America/Sao_Paulo',
            $manual,
            static fn (): DateTimeImmutable => new DateTimeImmutable($instant),
        );

        self::assertFalse($at('2026-12-25T02:59:59+00:00')->messagesReleased());
        self::assertTrue($at('2026-12-25T03:00:00+00:00')->messagesReleased());
        self::assertTrue($at('2027-01-01T00:00:00+00:00')->messagesReleased());
        self::assertTrue($at('2026-11-01T00:00:00+00:00', true)->messagesReleased());
        self::assertSame('2026-12-25T03:00:00Z', $at('2026-11-01T00:00:00+00:00')->revealAtUtc());
    }
}

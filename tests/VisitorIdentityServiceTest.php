<?php

declare(strict_types=1);

namespace Tests;

use App\Services\VisitorIdentityService;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryVisitorIdentityRepository;

final class VisitorIdentityServiceTest extends TestCase
{
    public function testIssuesSecurePersistentCookieAndRestoresAcrossServiceInstances(): void
    {
        $repository = new InMemoryVisitorIdentityRepository();
        $clock = static fn (): DateTimeImmutable => new DateTimeImmutable('2026-11-23T12:00:00+00:00');
        $firstService = new VisitorIdentityService($repository, 'visitor_id', 90, true, $clock);
        $first = $firstService->resolve(null);

        self::assertNotNull($first->cookieValue);
        self::assertStringContainsString('Max-Age=7776000', $firstService->cookieHeader($first->cookieValue));
        self::assertStringContainsString('HttpOnly', $firstService->cookieHeader($first->cookieValue));
        self::assertStringContainsString('SameSite=Lax', $firstService->cookieHeader($first->cookieValue));
        self::assertStringContainsString('Secure', $firstService->cookieHeader($first->cookieValue));

        $newPhpSession = new VisitorIdentityService($repository, 'visitor_id', 90, true, $clock);
        $restored = $newPhpSession->resolve($first->cookieValue);
        self::assertSame($first->identityId, $restored->identityId);
        self::assertNull($restored->cookieValue);
    }

    public function testInvalidAndExpiredCookiesReceiveFreshAnonymousIdentity(): void
    {
        $repository = new InMemoryVisitorIdentityRepository();
        $now = new DateTimeImmutable('2026-11-23T12:00:00+00:00');
        $service = new VisitorIdentityService($repository, clock: static fn () => $now);
        $invalid = $service->resolve('invalid');
        self::assertNotNull($invalid->cookieValue);

        $short = new VisitorIdentityService($repository, lifetimeDays: 1, clock: static fn () => $now);
        $issued = $short->resolve(null);
        $later = new VisitorIdentityService($repository, lifetimeDays: 1, clock: static fn () => $now->modify('+2 days'));
        $expired = $later->resolve($issued->cookieValue);
        self::assertNotSame($issued->identityId, $expired->identityId);
    }
}


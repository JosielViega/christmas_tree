<?php

declare(strict_types=1);

namespace Tests;

use App\Core\Session;
use App\Services\ChristmasTreeIdentityService;
use App\Services\PersistentTreeAccessService;
use App\Services\TreeOwnerSession;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeRepository;
use Tests\Support\InMemoryPersistentTreeCredentialRepository;

final class PersistentTreeAccessServiceTest extends TestCase
{
    public function testIssueRestoreCookieSecurityAndConcurrentRequests(): void
    {
        $_SESSION = [];
        $trees = new InMemoryChristmasTreeRepository();
        $tree = (new ChristmasTreeIdentityService($trees))->create('Nina')->tree;
        $repository = new InMemoryPersistentTreeCredentialRepository();
        $repository->registerTree($tree);
        $clock = static fn (): DateTimeImmutable => new DateTimeImmutable('2026-11-20T12:00:00Z');
        $service = new PersistentTreeAccessService($repository, new TreeOwnerSession(new Session(false)), 'tree_access', 90, true, $clock);
        $cookie = $service->issue($tree);

        self::assertMatchesRegularExpression('/^[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/', $cookie);
        self::assertStringContainsString('HttpOnly', $service->cookieHeader($cookie));
        self::assertStringContainsString('SameSite=Lax', $service->cookieHeader($cookie));
        self::assertStringContainsString('; Secure', $service->cookieHeader($cookie));
        self::assertStringNotContainsString($cookie, json_encode($tree->toPublicArray(), JSON_THROW_ON_ERROR));

        $_SESSION = [];
        $first = new PersistentTreeAccessService($repository, new TreeOwnerSession(new Session(false)), 'tree_access', 90, true, $clock);
        $second = new PersistentTreeAccessService($repository, new TreeOwnerSession(new Session(false)), 'tree_access', 90, true, $clock);
        self::assertSame($tree->publicId, $first->restore($cookie)?->publicId);
        self::assertSame($tree->publicId, $second->restore($cookie)?->publicId);
    }

    public function testInvalidExpiredRevokedAndRotatedCredentialsAreRejected(): void
    {
        $_SESSION = [];
        $trees = new InMemoryChristmasTreeRepository();
        $tree = (new ChristmasTreeIdentityService($trees))->create('Lia')->tree;
        $repository = new InMemoryPersistentTreeCredentialRepository();
        $repository->registerTree($tree);
        $clock = static fn (): DateTimeImmutable => new DateTimeImmutable('2026-11-20T12:00:00Z');
        $owner = new TreeOwnerSession(new Session(false));
        $issuer = new PersistentTreeAccessService($repository, $owner, 'tree_access', 90, false, $clock);
        $original = $issuer->issue($tree);

        $invalid = new PersistentTreeAccessService($repository, $owner, 'tree_access', 90, false, $clock);
        self::assertNull($invalid->restore(str_repeat('x', 22) . '.' . str_repeat('y', 43)));
        self::assertTrue($invalid->shouldClearCookie());

        [$selector] = explode('.', $original);
        $repository->records[$selector]['expiresAt'] = '2026-11-19 00:00:00.000000';
        self::assertNull((new PersistentTreeAccessService($repository, $owner, 'tree_access', 90, false, $clock))->restore($original));

        $repository->records[$selector]['expiresAt'] = '2027-01-01 00:00:00.000000';
        $repository->revokeSelector($selector, '2026-11-20 12:00:00.000000');
        self::assertNull((new PersistentTreeAccessService($repository, $owner, 'tree_access', 90, false, $clock))->restore($original));

        $rotated = $issuer->issue($tree, null, true);
        self::assertNotSame($original, $rotated);
        self::assertNull((new PersistentTreeAccessService($repository, $owner, 'tree_access', 90, false, $clock))->restore($original));
        self::assertSame($tree->publicId, (new PersistentTreeAccessService($repository, $owner, 'tree_access', 90, false, $clock))->restore($rotated)?->publicId);
    }
}

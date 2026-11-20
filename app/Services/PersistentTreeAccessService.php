<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\ChristmasTree;
use App\Repositories\PersistentTreeCredentialRepository;
use Closure;
use DateTimeImmutable;
use DateTimeZone;

final class PersistentTreeAccessService
{
    private readonly Closure $clock;
    private ?ChristmasTree $restored = null;
    private bool $attempted = false;
    private bool $invalid = false;

    public function __construct(
        private readonly PersistentTreeCredentialRepository $credentials,
        private readonly TreeOwnerSession $ownerSession,
        public readonly string $cookieName,
        private readonly int $lifetimeDays = 90,
        private readonly bool $secureCookie = false,
        ?callable $clock = null,
    ) {
        $this->clock = $clock === null
            ? static fn (): DateTimeImmutable => new DateTimeImmutable('now', new DateTimeZone('UTC'))
            : Closure::fromCallable($clock);
    }

    public function issue(ChristmasTree $tree, ?string $currentCookie = null, bool $revokeTree = false): string
    {
        $now = ($this->clock)();
        if ($revokeTree) {
            $this->credentials->revokeForTree($tree->id, $this->format($now));
        } elseif (is_string($currentCookie) && $currentCookie !== '') {
            [$selector] = $this->parse($currentCookie) ?? [null, null];
            if (is_string($selector)) $this->credentials->revokeSelector($selector, $this->format($now));
        }
        $selector = self::token(16);
        $verifier = self::token(32);
        $this->credentials->create(
            $tree->id, $selector, hash('sha256', $verifier), $this->format($now),
            $this->format($now->modify('+' . max(1, $this->lifetimeDays) . ' days')),
        );
        $this->ownerSession->grantPersistent($tree->publicId);
        return $selector . '.' . $verifier;
    }

    public function restore(?string $cookie): ?ChristmasTree
    {
        if ($this->attempted) return $this->restored;
        $this->attempted = true;
        if (!is_string($cookie) || $cookie === '') return null;
        $parts = $this->parse($cookie);
        if ($parts === null) { $this->invalid = true; return null; }
        [$selector, $verifier] = $parts;
        $credential = $this->credentials->findBySelector($selector);
        $now = ($this->clock)();
        if ($credential === null || $credential->revokedAt !== null || $credential->tree->status !== 'active'
            || new DateTimeImmutable($credential->expiresAt, new DateTimeZone('UTC')) <= $now
            || !hash_equals($credential->verifierHash, hash('sha256', $verifier))
            || !$this->credentials->touchIfActive($credential->id, $this->format($now))) {
            $this->invalid = true;
            return null;
        }
        $this->ownerSession->grantPersistent($credential->tree->publicId);
        return $this->restored = $credential->tree;
    }

    public function shouldClearCookie(): bool
    {
        return $this->invalid;
    }

    public function cookieHeader(string $token): string
    {
        $maxAge = max(1, $this->lifetimeDays) * 86400;
        return rawurlencode($this->cookieName) . '=' . rawurlencode($token)
            . '; Max-Age=' . $maxAge . '; Expires=' . gmdate('D, d M Y H:i:s T', time() + $maxAge)
            . '; Path=/; HttpOnly; SameSite=Lax' . ($this->secureCookie ? '; Secure' : '');
    }

    public function clearCookieHeader(): string
    {
        return rawurlencode($this->cookieName) . '=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; SameSite=Lax'
            . ($this->secureCookie ? '; Secure' : '');
    }

    private function parse(string $cookie): ?array
    {
        if (preg_match('/^([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/D', $cookie, $matches) !== 1) return null;
        return [$matches[1], $matches[2]];
    }

    private function format(DateTimeImmutable $date): string
    {
        return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
    }

    private static function token(int $bytes): string
    {
        return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
    }
}

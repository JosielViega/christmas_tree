<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\VisitorIdentityAccess;
use App\Repositories\VisitorIdentityRepository;
use Closure;
use DateTimeImmutable;
use DateTimeZone;

final class VisitorIdentityService
{
    private readonly Closure $clock;

    public function __construct(
        private readonly VisitorIdentityRepository $identities,
        public readonly string $cookieName = 'christmas_tree_visitor',
        private readonly int $lifetimeDays = 90,
        private readonly bool $secureCookie = false,
        ?callable $clock = null,
    ) {
        $this->clock = $clock === null
            ? static fn (): DateTimeImmutable => new DateTimeImmutable('now', new DateTimeZone('UTC'))
            : Closure::fromCallable($clock);
    }

    public function resolve(?string $cookie): VisitorIdentityAccess
    {
        $now = ($this->clock)();
        $parts = is_string($cookie) ? $this->parse($cookie) : null;
        if ($parts !== null) {
            [$selector, $verifier] = $parts;
            $credential = $this->identities->findBySelector($selector);
            if ($credential !== null && $credential->revokedAt === null
                && new DateTimeImmutable($credential->expiresAt, new DateTimeZone('UTC')) > $now
                && hash_equals($credential->verifierHash, hash('sha256', $verifier))
                && $this->identities->touchIfActive($credential->id, $this->format($now))) {
                return new VisitorIdentityAccess($credential->id, null);
            }
        }

        $selector = self::token(16);
        $verifier = self::token(32);
        $expires = $now->modify('+' . max(1, $this->lifetimeDays) . ' days');
        $id = $this->identities->create($selector, hash('sha256', $verifier), $this->format($now), $this->format($expires));
        return new VisitorIdentityAccess($id, $selector . '.' . $verifier);
    }

    public function cookieHeader(string $token): string
    {
        $now = ($this->clock)();
        $maxAge = max(1, $this->lifetimeDays) * 86400;
        return rawurlencode($this->cookieName) . '=' . rawurlencode($token)
            . '; Max-Age=' . $maxAge . '; Expires=' . $now->setTimezone(new DateTimeZone('UTC'))->modify('+' . $maxAge . ' seconds')->format('D, d M Y H:i:s \G\M\T')
            . '; Path=/; HttpOnly; SameSite=Lax' . ($this->secureCookie ? '; Secure' : '');
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

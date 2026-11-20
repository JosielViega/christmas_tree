<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Session;

final class TreeOwnerSession
{
    private const SESSION_KEY = '_christmas_tree_admin_tokens';
    private const PERSISTENT_KEY = '_christmas_tree_persistent_owners';
    private const PRIMARY_KEY = '_christmas_tree_primary';

    public function __construct(private readonly Session $session)
    {
    }

    public function grant(string $publicId, string $adminToken): void
    {
        $tokens = $this->tokens();
        $tokens[$publicId] = $adminToken;
        $this->session->regenerate();
        $this->session->put(self::SESSION_KEY, $tokens);
        $this->session->put(self::PRIMARY_KEY, $publicId);
    }

    public function tokenFor(string $publicId): ?string
    {
        $token = $this->tokens()[$publicId] ?? null;

        return is_string($token) ? $token : null;
    }

    public function grantPersistent(string $publicId): void
    {
        $owners = $this->persistentOwners();
        if (!isset($owners[$publicId])) {
            $this->session->regenerate();
            $owners[$publicId] = true;
            $this->session->put(self::PERSISTENT_KEY, $owners);
        }
        $this->session->put(self::PRIMARY_KEY, $publicId);
    }

    public function isAuthorized(string $publicId, ChristmasTreeIdentityService $trees): bool
    {
        return isset($this->persistentOwners()[$publicId])
            || $trees->ownerIsAuthorized($publicId, $this->tokenFor($publicId));
    }

    public function primaryPublicId(): ?string
    {
        $publicId = $this->session->get(self::PRIMARY_KEY);
        return is_string($publicId) ? $publicId : null;
    }

    /** @return array<string, string> */
    private function tokens(): array
    {
        $tokens = $this->session->get(self::SESSION_KEY, []);

        return is_array($tokens) ? array_filter($tokens, 'is_string') : [];
    }

    /** @return array<string, true> */
    private function persistentOwners(): array
    {
        $owners = $this->session->get(self::PERSISTENT_KEY, []);
        return is_array($owners) ? array_filter($owners, static fn ($value): bool => $value === true) : [];
    }
}

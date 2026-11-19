<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Session;

final class TreeOwnerSession
{
    private const SESSION_KEY = '_christmas_tree_admin_tokens';

    public function __construct(private readonly Session $session)
    {
    }

    public function grant(string $publicId, string $adminToken): void
    {
        $tokens = $this->tokens();
        $tokens[$publicId] = $adminToken;
        $this->session->regenerate();
        $this->session->put(self::SESSION_KEY, $tokens);
    }

    public function tokenFor(string $publicId): ?string
    {
        $token = $this->tokens()[$publicId] ?? null;

        return is_string($token) ? $token : null;
    }

    /** @return array<string, string> */
    private function tokens(): array
    {
        $tokens = $this->session->get(self::SESSION_KEY, []);

        return is_array($tokens) ? array_filter($tokens, 'is_string') : [];
    }
}

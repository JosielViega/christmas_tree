<?php

declare(strict_types=1);

if (!function_exists('env')) {
    function env(string $key, mixed $default = null): mixed
    {
        $value = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);

        if ($value === false || $value === null) {
            return $default;
        }

        return match (strtolower((string) $value)) {
            'true', '(true)' => true,
            'false', '(false)' => false,
            'null', '(null)' => null,
            'empty', '(empty)' => '',
            default => $value,
        };
    }
}

if (!function_exists('e')) {
    function e(mixed $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

if (!function_exists('public_app_url')) {
    function public_app_url(string $baseUrl, string $path = '/'): string
    {
        $parts = parse_url($baseUrl);
        $scheme = is_array($parts) ? strtolower((string) ($parts['scheme'] ?? '')) : '';
        $host = is_array($parts) ? (string) ($parts['host'] ?? '') : '';
        if (!in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new InvalidArgumentException('APP_URL must be an absolute HTTP(S) URL.');
        }

        $authority = $scheme . '://' . (str_contains($host, ':') ? '[' . trim($host, '[]') . ']' : $host);
        if (isset($parts['port'])) {
            $authority .= ':' . (int) $parts['port'];
        }
        $basePath = rtrim((string) ($parts['path'] ?? ''), '/');

        return $authority . $basePath . '/' . ltrim($path, '/');
    }
}

if (!function_exists('public_tree_url')) {
    function public_tree_url(string $baseUrl, string $publicId): string
    {
        return public_app_url($baseUrl, '/t/' . rawurlencode($publicId));
    }
}

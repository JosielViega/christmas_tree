<?php

declare(strict_types=1);

namespace App\Core;

use JsonException;
use RuntimeException;

final class FrontendAssets
{
    /** @var null|array<string, array<string, mixed>> */
    private ?array $manifest = null;

    public function __construct(
        private readonly string $manifestPath,
        private readonly string $publicBase = '/assets/app/',
    ) {
    }

    /** @return array{script: string, styles: list<string>} */
    public function entry(string $source): array
    {
        $manifest = $this->manifest();
        $entry = $manifest[$source] ?? null;

        if (!is_array($entry) || !isset($entry['file']) || !is_string($entry['file'])) {
            throw new RuntimeException("Frontend entry is missing from the Vite manifest: {$source}");
        }

        $styles = [];
        foreach ($entry['css'] ?? [] as $stylesheet) {
            if (is_string($stylesheet)) {
                $styles[] = $this->url($stylesheet);
            }
        }

        return ['script' => $this->url($entry['file']), 'styles' => $styles];
    }

    /** @return array<string, array<string, mixed>> */
    private function manifest(): array
    {
        if ($this->manifest !== null) {
            return $this->manifest;
        }

        if (!is_file($this->manifestPath)) {
            throw new RuntimeException('Compiled frontend assets are missing. Run npm --prefix frontend run build.');
        }

        try {
            $manifest = json_decode(
                (string) file_get_contents($this->manifestPath),
                true,
                512,
                JSON_THROW_ON_ERROR,
            );
        } catch (JsonException $exception) {
            throw new RuntimeException('The Vite manifest is invalid.', previous: $exception);
        }

        if (!is_array($manifest)) {
            throw new RuntimeException('The Vite manifest must contain an object.');
        }

        return $this->manifest = $manifest;
    }

    private function url(string $file): string
    {
        return rtrim($this->publicBase, '/') . '/' . ltrim($file, '/');
    }
}

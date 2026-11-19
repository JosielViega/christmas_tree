<?php

declare(strict_types=1);

namespace App\Services;

use RuntimeException;

final class RateLimiter
{
    public function __construct(
        private readonly string $directory,
        private readonly int $maxAttempts,
        private readonly int $windowSeconds,
    ) {
    }

    public function consume(string $key): bool
    {
        if (!is_dir($this->directory) && !mkdir($this->directory, 0775, true) && !is_dir($this->directory)) {
            throw new RuntimeException('Unable to initialize the rate limiter.');
        }

        $path = $this->directory . DIRECTORY_SEPARATOR . hash('sha256', $key) . '.json';
        $handle = fopen($path, 'c+');
        if ($handle === false) {
            throw new RuntimeException('Unable to open the rate limiter state.');
        }

        try {
            if (!flock($handle, LOCK_EX)) {
                throw new RuntimeException('Unable to lock the rate limiter state.');
            }

            $contents = stream_get_contents($handle);
            $decoded = is_string($contents) && $contents !== '' ? json_decode($contents, true) : [];
            $cutoff = time() - $this->windowSeconds;
            $attempts = array_values(array_filter(
                is_array($decoded) ? $decoded : [],
                static fn (mixed $timestamp): bool => is_int($timestamp) && $timestamp > $cutoff,
            ));

            if (count($attempts) >= $this->maxAttempts) {
                return false;
            }

            $attempts[] = time();
            rewind($handle);
            ftruncate($handle, 0);
            fwrite($handle, json_encode($attempts, JSON_THROW_ON_ERROR));
            fflush($handle);

            return true;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }
}

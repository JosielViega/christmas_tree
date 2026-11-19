<?php

declare(strict_types=1);

namespace Tests;

use App\Services\RateLimiter;
use PHPUnit\Framework\TestCase;

final class RateLimiterTest extends TestCase
{
    public function testRejectsAttemptsBeyondTheConfiguredLimit(): void
    {
        $directory = sys_get_temp_dir() . '/rate-limiter-' . bin2hex(random_bytes(6));

        try {
            $limiter = new RateLimiter($directory, 2, 900);
            self::assertTrue($limiter->consume('same-client'));
            self::assertTrue($limiter->consume('same-client'));
            self::assertFalse($limiter->consume('same-client'));
            self::assertTrue($limiter->consume('another-client'));
        } finally {
            if (is_dir($directory)) {
                foreach (new \DirectoryIterator($directory) as $item) {
                    if (!$item->isDot()) {
                        unlink($item->getPathname());
                    }
                }
                rmdir($directory);
            }
        }
    }
}

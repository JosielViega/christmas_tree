<?php

declare(strict_types=1);

namespace Tests;

use App\Console\ProcessLock;
use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__) . '/bin/lib/ProcessLock.php';

final class ProcessLockTest extends TestCase
{
    public function testPreventsOverlapAndCanBeAcquiredAfterRelease(): void
    {
        $directory = sys_get_temp_dir() . '/christmas-tree-lock-' . bin2hex(random_bytes(6));
        $path = $directory . '/maintenance.lock';
        $first = new ProcessLock($path);
        $second = new ProcessLock($path);

        try {
            self::assertTrue($first->acquire());
            self::assertFalse($second->acquire());
            self::assertFileExists($path);
            $first->release();
            $metadata = json_decode((string) file_get_contents($path), true, 8, JSON_THROW_ON_ERROR);
            self::assertIsInt($metadata['pid']);
            self::assertIsString($metadata['started_at']);

            self::assertTrue($second->acquire());
        } finally {
            $first->release();
            $second->release();
            if (is_file($path)) unlink($path);
            if (is_dir($directory)) rmdir($directory);
        }
    }
}

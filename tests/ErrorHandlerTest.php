<?php

declare(strict_types=1);

namespace Tests;

use App\Core\ErrorHandler;
use App\Core\Logger;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class ErrorHandlerTest extends TestCase
{
    private string $logDirectory;

    protected function setUp(): void
    {
        $this->logDirectory = sys_get_temp_dir() . '/christmas-tree-errors-' . bin2hex(random_bytes(6));
    }

    protected function tearDown(): void
    {
        foreach (glob($this->logDirectory . '/*') ?: [] as $file) {
            unlink($file);
        }
        if (is_dir($this->logDirectory)) {
            rmdir($this->logDirectory);
        }
    }

    public function testUnhandledApiExceptionReturnsSanitizedJsonAndSanitizesLogMessage(): void
    {
        $handler = new ErrorHandler(new Logger($this->logDirectory), true);
        $response = $handler->responseFor(
            new RuntimeException('Connection failed password=do-not-expose token:also-private'),
            '/api/trees',
        );

        self::assertSame(500, $response->status());
        self::assertSame('application/json; charset=UTF-8', $response->headers()['Content-Type']);
        self::assertSame('no-store', $response->headers()['Cache-Control']);
        self::assertStringContainsString('internal_error', $response->body());
        self::assertStringNotContainsString('do-not-expose', $response->body());

        $log = file_get_contents((glob($this->logDirectory . '/*.log') ?: [])[0] ?? '');
        self::assertIsString($log);
        self::assertStringContainsString('password=<redacted>', $log);
        self::assertStringContainsString('token:<redacted>', $log);
        self::assertStringNotContainsString('do-not-expose', $log);
        self::assertStringNotContainsString('also-private', $log);
    }

    public function testRegularPageKeepsHtmlErrorResponse(): void
    {
        $handler = new ErrorHandler(new Logger($this->logDirectory), false);
        $response = $handler->responseFor(new RuntimeException('Failure'), '/t/AbCdEf1234_-');

        self::assertSame(500, $response->status());
        self::assertSame('text/html; charset=UTF-8', $response->headers()['Content-Type']);
        self::assertStringContainsString('Unexpected error', $response->body());
    }
}

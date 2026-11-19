<?php

declare(strict_types=1);

namespace App\Core;

use ErrorException;
use Throwable;

final class ErrorHandler
{
    public function __construct(
        private readonly Logger $logger,
        private readonly bool $debug,
    ) {
    }

    public function register(): void
    {
        error_reporting(E_ALL);
        ini_set('display_errors', '0');

        set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
            if (!(error_reporting() & $severity)) {
                return false;
            }

            throw new ErrorException($message, 0, $severity, $file, $line);
        });

        set_exception_handler(fn (Throwable $exception) => $this->render($exception));
    }

    private function render(Throwable $exception): never
    {
        $this->responseFor($exception)->send();
    }

    public function responseFor(Throwable $exception, ?string $requestUri = null): Response
    {
        $reference = bin2hex(random_bytes(6));
        $this->logger->error($this->sanitizeLogMessage($exception->getMessage()), [
            'reference' => $reference,
            'exception' => $exception::class,
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $this->sanitizeLogMessage($exception->getTraceAsString()),
        ]);

        $path = parse_url($requestUri ?? (string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
        if (is_string($path) && ($path === '/api' || str_starts_with($path, '/api/'))) {
            return Response::json(['error' => [
                'code' => 'internal_error',
                'message' => 'O servidor não conseguiu concluir a solicitação. Tente novamente.',
                'reference' => $reference,
            ]], 500)->withHeader('Cache-Control', 'no-store');
        }

        $message = $this->debug
            ? '<h1>Application error</h1><pre>' . e((string) $exception) . '</pre>'
            : '<h1>Unexpected error</h1><p>Please try again later. Reference: ' . e($reference) . '</p>';

        return Response::html($message, 500);
    }

    private function sanitizeLogMessage(string $message): string
    {
        $sanitized = preg_replace(
            [
                '/((?:password|passwd|pwd|authorization|token|secret)\s*[:=]\s*)("[^"]*"|\'[^\']*\'|[^\s,;]+)/i',
                '/(\/\/[^:\/\s]+:)[^@\s]+@/',
            ],
            ['$1<redacted>', '$1<redacted>@'],
            $message,
        );

        return is_string($sanitized) ? $sanitized : 'Application failure.';
    }
}

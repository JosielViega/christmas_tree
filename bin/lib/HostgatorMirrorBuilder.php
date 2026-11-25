<?php

declare(strict_types=1);

namespace TemplateTools;

use FilesystemIterator;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use SplFileInfo;

final class HostgatorMirrorBuilder
{
    private readonly string $mirror;

    public function __construct(
        private readonly string $root,
        private readonly array $manifest,
        private readonly string $composerBinary,
    ) {
        $this->mirror = $this->root . '/deploy/hostgator/mirror';
    }

    /** @return array{files: int, composerVersion: string, commit: ?string, workingTreeDirty: ?bool} */
    public function build(): array
    {
        $this->assertProjectInputs();
        $this->removeMirror();
        $this->createDirectory($this->mirror);

        try {
            foreach ($this->manifest['include'] as $relativePath) {
                $this->copyAllowedPath((string) $relativePath);
            }

            fwrite(STDOUT, 'Application files copied.' . PHP_EOL);
            $composerVersion = $this->installProductionDependencies();
            fwrite(STDOUT, 'Production Composer dependencies installed.' . PHP_EOL);

            $this->validate();
            fwrite(STDOUT, 'Protected server files excluded.' . PHP_EOL);
            fwrite(STDOUT, 'Uploads excluded.' . PHP_EOL);
            fwrite(STDOUT, 'Logs excluded.' . PHP_EOL);
            fwrite(STDOUT, 'Cache excluded.' . PHP_EOL);
            fwrite(STDOUT, 'Secrets check passed.' . PHP_EOL);

            $files = $this->countFiles();
            $commit = $this->currentCommit();
            $workingTreeDirty = $this->workingTreeDirty();
            $this->writeBuildInfo($files, $composerVersion, $commit, $workingTreeDirty);

            return ['files' => $files, 'composerVersion' => $composerVersion, 'commit' => $commit, 'workingTreeDirty' => $workingTreeDirty];
        } catch (\Throwable $exception) {
            $this->removeMirror();
            throw $exception;
        }
    }

    public function validate(): void
    {
        $required = [
            'app',
            'bin/cleanup-gift-drafts.php',
            'bin/lib/ProcessLock.php',
            'bin/migrate.php',
            'bin/migrations-status.php',
            'bootstrap/app.php',
            'config/app.php',
            'config/database.php',
            'public/index.php',
            'public/.htaccess',
            'public/assets/app/.vite/manifest.json',
            'resources/views',
            'routes/web.php',
            'storage/private/.gitkeep',
            'composer.json',
            'composer.lock',
            'vendor/autoload.php',
            'vendor/composer/installed.json',
        ];

        foreach ($required as $path) {
            if (!file_exists($this->mirror . '/' . $path)) {
                throw new RuntimeException('Required production item is missing: ' . $path);
            }
        }

        foreach ($this->files() as $file) {
            $relative = $this->relativePath($file->getPathname());
            $this->assertSafeRelativePath($relative);
            $this->assertSafePublicFile($relative);
            $this->assertNoSecretContent($file, $relative);
        }

        $installed = json_decode(
            (string) file_get_contents($this->mirror . '/vendor/composer/installed.json'),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );
        $packages = $installed['packages'] ?? $installed;
        foreach ($packages as $package) {
            $name = strtolower((string) ($package['name'] ?? ''));
            if (str_starts_with($name, 'phpunit/') || str_starts_with($name, 'sebastian/')) {
                throw new RuntimeException('Development dependency found in production vendor: ' . $name);
            }
        }
    }

    private function assertProjectInputs(): void
    {
        foreach ($this->manifest['include'] as $relativePath) {
            if (!file_exists($this->root . '/' . $relativePath)) {
                throw new RuntimeException('Manifest include does not exist: ' . $relativePath);
            }
        }

        if (!is_file($this->root . '/composer.lock')) {
            throw new RuntimeException('composer.lock is required for a reproducible production build.');
        }
    }

    private function copyAllowedPath(string $relativePath): void
    {
        $source = $this->root . '/' . $relativePath;
        $destination = $this->mirror . '/' . $relativePath;

        if (is_link($source)) {
            throw new RuntimeException('Symbolic links are not allowed in deployment sources: ' . $relativePath);
        }

        if (is_file($source)) {
            $this->assertSafeRelativePath($relativePath);
            $this->createDirectory(dirname($destination));
            if (!copy($source, $destination)) {
                throw new RuntimeException('Unable to copy production file: ' . $relativePath);
            }
            return;
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST,
        );

        $this->createDirectory($destination);
        foreach ($iterator as $item) {
            $sourcePath = $item->getPathname();
            $child = $relativePath . '/' . str_replace('\\', '/', substr($sourcePath, strlen($source) + 1));
            $target = $this->mirror . '/' . $child;

            if ($item->isLink()) {
                throw new RuntimeException('Symbolic links are not allowed in deployment sources: ' . $child);
            }

            $this->assertSafeRelativePath($child);
            if ($item->isDir()) {
                $this->createDirectory($target);
            } elseif (!copy($sourcePath, $target)) {
                throw new RuntimeException('Unable to copy production file: ' . $child);
            }
        }
    }

    private function installProductionDependencies(): string
    {
        $command = $this->composerCommand()
            . ' install --working-dir=' . escapeshellarg($this->mirror)
            . ' --no-dev --classmap-authoritative --no-interaction --prefer-dist --no-progress';
        passthru($command, $exitCode);

        if ($exitCode !== 0) {
            throw new RuntimeException('Composer could not install production dependencies in the mirror.');
        }

        $output = [];
        exec($this->composerCommand() . ' --version --no-ansi 2>&1', $output, $versionExitCode);
        if ($versionExitCode !== 0) {
            throw new RuntimeException('Unable to determine the Composer version.');
        }

        $versionOutput = trim(implode(' ', $output));
        if (preg_match('/Composer version ([0-9]+\.[0-9]+\.[0-9]+(?:[-+][^\s]+)?)/', $versionOutput, $matches) !== 1) {
            throw new RuntimeException('Composer returned an unrecognized version string.');
        }

        return $matches[1];
    }

    private function composerCommand(): string
    {
        if (str_ends_with(strtolower($this->composerBinary), '.phar')) {
            return escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($this->composerBinary);
        }

        return escapeshellarg($this->composerBinary);
    }

    private function assertSafeRelativePath(string $relativePath): void
    {
        $normalized = str_replace('\\', '/', $relativePath);
        $segments = explode('/', strtolower($normalized));
        $basename = strtolower((string) end($segments));
        $extension = strtolower(pathinfo($basename, PATHINFO_EXTENSION));
        $allowedServerFile = in_array($normalized, $this->manifest['allowed_server_files'] ?? [], true);

        if (str_starts_with($basename, '.env')
            || (!$allowedServerFile && in_array($basename, array_map('strtolower', $this->manifest['protected_names']), true))
        ) {
            throw new RuntimeException('Protected server file detected: ' . $normalized);
        }

        if ($extension !== '' && in_array($extension, $this->manifest['protected_extensions'], true)) {
            throw new RuntimeException('Protected file extension detected: ' . $normalized);
        }

        foreach ($segments as $segment) {
            if (in_array($segment, $this->manifest['protected_directories'], true)) {
                throw new RuntimeException('Protected directory detected: ' . $normalized);
            }
        }

        foreach ($this->manifest['sensitive_name_patterns'] as $pattern) {
            if (preg_match($pattern, $basename) === 1) {
                throw new RuntimeException('Sensitive-looking filename detected: ' . $normalized);
            }
        }
    }

    private function assertSafePublicFile(string $relativePath): void
    {
        $normalized = strtolower(str_replace('\\', '/', $relativePath));
        if (!str_starts_with($normalized, 'public/')) {
            return;
        }
        $extension = strtolower(pathinfo($normalized, PATHINFO_EXTENSION));
        if (in_array($extension, ['php', 'phtml', 'phar'], true) && $normalized !== 'public/index.php') {
            throw new RuntimeException('Unexpected executable file inside the public root: ' . $relativePath);
        }
    }

    private function assertNoSecretContent(SplFileInfo $file, string $relativePath): void
    {
        if ($file->getSize() > 5 * 1024 * 1024) {
            return;
        }
        $contents = file_get_contents($file->getPathname());
        if (!is_string($contents) || str_contains($contents, "\0")) {
            return;
        }
        foreach ($this->manifest['secret_content_patterns'] ?? [] as $pattern) {
            if (preg_match($pattern, $contents) === 1) {
                throw new RuntimeException('Secret-like content detected in deployment file: ' . $relativePath);
            }
        }
    }

    private function removeMirror(): void
    {
        $expected = str_replace('\\', '/', $this->root . '/deploy/hostgator/mirror');
        if (str_replace('\\', '/', $this->mirror) !== $expected) {
            throw new RuntimeException('Refusing to remove an unexpected deployment path.');
        }

        if (is_link($this->mirror)) {
            if (!unlink($this->mirror)) {
                throw new RuntimeException('Unable to remove the mirror symbolic link.');
            }
            return;
        }

        if (!is_dir($this->mirror)) {
            return;
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($this->mirror, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST,
        );
        foreach ($iterator as $item) {
            $removed = $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
            if (!$removed) {
                throw new RuntimeException('Unable to clean generated mirror item: ' . $item->getFilename());
            }
        }

        if (!rmdir($this->mirror)) {
            throw new RuntimeException('Unable to clean the generated mirror directory.');
        }
    }

    private function createDirectory(string $directory): void
    {
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new RuntimeException('Unable to create directory: ' . basename($directory));
        }
    }

    /** @return iterable<SplFileInfo> */
    private function files(): iterable
    {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($this->mirror, FilesystemIterator::SKIP_DOTS),
        );

        foreach ($iterator as $item) {
            if ($item->isFile()) {
                yield $item;
            }
        }
    }

    private function relativePath(string $path): string
    {
        return str_replace('\\', '/', substr($path, strlen($this->mirror) + 1));
    }

    private function countFiles(): int
    {
        return iterator_count($this->files());
    }

    private function currentCommit(): ?string
    {
        $output = [];
        exec('git -C ' . escapeshellarg($this->root) . ' rev-parse HEAD 2>&1', $output, $exitCode);
        if ($exitCode !== 0) {
            return null;
        }

        foreach ($output as $line) {
            $commit = trim($line);
            if (preg_match('/^[a-f0-9]{40}$/', $commit) === 1) {
                return $commit;
            }
        }

        return null;
    }

    private function workingTreeDirty(): ?bool
    {
        $output = [];
        exec('git -C ' . escapeshellarg($this->root) . ' status --porcelain --untracked-files=normal 2>&1', $output, $exitCode);
        if ($exitCode !== 0) {
            return null;
        }

        return $output !== [];
    }

    private function writeBuildInfo(int $files, string $composerVersion, ?string $commit, ?bool $workingTreeDirty): void
    {
        $information = [
            'built_at' => gmdate(DATE_ATOM),
            'commit' => $commit,
            'working_tree_dirty' => $workingTreeDirty,
            'php_version' => PHP_VERSION,
            'composer_version' => $composerVersion,
            'install_mode' => 'no-dev, classmap-authoritative',
            'file_count' => $files,
        ];
        $path = $this->root . '/deploy/hostgator/build-info.json';
        $json = json_encode($information, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

        if (file_put_contents($path, $json . PHP_EOL, LOCK_EX) === false) {
            throw new RuntimeException('Unable to write build-info.json.');
        }
    }
}

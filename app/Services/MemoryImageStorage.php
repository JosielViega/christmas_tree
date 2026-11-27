<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\MemoryValidationException;
use finfo;
use RuntimeException;

final class MemoryImageStorage
{
    public const MAX_DIMENSION = 1024;
    public const MIN_DIMENSION = 64;

    public function __construct(private readonly string $root, private readonly int $maxInputBytes = 8388608)
    {
    }

    /** @param array<string, mixed> $upload */
    public function store(array $upload): StoredMemoryImage
    {
        if (!extension_loaded('gd') || !function_exists('imagejpeg')) {
            throw new RuntimeException('GD with JPEG support is required for memory processing.');
        }
        $path = is_string($upload['tmp_name'] ?? null) ? $upload['tmp_name'] : '';
        $size = (int) ($upload['size'] ?? 0);
        if ((int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || $path === '' || !is_file($path)) {
            throw $this->invalid('Selecione uma fotografia válida.');
        }
        if ($size < 1 || $size > $this->maxInputBytes) {
            throw $this->invalid('A fotografia deve ter no máximo 8 MB.');
        }
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($path);
        $prefix = (string) file_get_contents($path, false, null, 0, 16);
        $validSignature = match ($mime) {
            'image/jpeg' => str_starts_with($prefix, "\xFF\xD8\xFF"),
            'image/png' => str_starts_with($prefix, "\x89PNG\r\n\x1a\n"),
            'image/webp' => substr($prefix, 0, 4) === 'RIFF' && substr($prefix, 8, 4) === 'WEBP',
            default => false,
        };
        if (!$validSignature) throw $this->invalid('Envie uma fotografia JPEG, PNG ou WebP válida.');
        $dimensions = @getimagesize($path);
        if (!is_array($dimensions)) throw $this->invalid('Não foi possível decodificar a fotografia.');
        $width = (int) $dimensions[0];
        $height = (int) $dimensions[1];
        if ($width < self::MIN_DIMENSION || $height < self::MIN_DIMENSION || $width > 12000 || $height > 12000
            || $width * $height > 40000000) {
            throw $this->invalid('A fotografia possui dimensões inválidas ou grandes demais.');
        }
        $source = match ($mime) {
            'image/jpeg' => function_exists('imagecreatefromjpeg') ? @imagecreatefromjpeg($path) : false,
            'image/png' => function_exists('imagecreatefrompng') ? @imagecreatefrompng($path) : false,
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
            default => false,
        };
        if ($source === false) throw $this->invalid('Não foi possível decodificar a fotografia.');

        $targetSize = min(self::MAX_DIMENSION, max($width, $height));
        $target = imagecreatetruecolor($targetSize, $targetSize);
        if ($target === false) throw new RuntimeException('Unable to allocate normalized memory image.');
        $background = imagecolorallocate($target, 248, 245, 235);
        imagefill($target, 0, 0, $background);
        $scale = min($targetSize / $width, $targetSize / $height);
        $fittedWidth = max(1, (int) round($width * $scale));
        $fittedHeight = max(1, (int) round($height * $scale));
        $offsetX = intdiv($targetSize - $fittedWidth, 2);
        $offsetY = intdiv($targetSize - $fittedHeight, 2);
        imagecopyresampled(
            $target, $source, $offsetX, $offsetY, 0, 0,
            $fittedWidth, $fittedHeight, $width, $height,
        );

        $relativeDirectory = gmdate('Y/m');
        $directory = $this->root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativeDirectory);
        if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
            throw new RuntimeException('Unable to initialize memory storage.');
        }
        $filename = bin2hex(random_bytes(20)) . '.jpg';
        $logicalPath = $relativeDirectory . '/' . $filename;
        $finalPath = $directory . DIRECTORY_SEPARATOR . $filename;
        $temporary = $directory . DIRECTORY_SEPARATOR . '.' . $filename . '.tmp';
        try {
            if (!imagejpeg($target, $temporary, 85) || !rename($temporary, $finalPath)) {
                throw new RuntimeException('Unable to persist normalized memory image.');
            }
            chmod($finalPath, 0640);
        } finally {
            if (is_file($temporary)) unlink($temporary);
        }
        return new StoredMemoryImage($logicalPath);
    }

    public function delete(string $logicalPath): bool
    {
        $path = $this->resolve($logicalPath, false);
        return $path === null || unlink($path);
    }

    /** @return array{path: string, size: int, sha256: string} */
    public function inspect(string $logicalPath): array
    {
        $path = $this->resolve($logicalPath, true);
        if ($path === null) throw new RuntimeException('Memory image is unavailable.');
        $size = filesize($path);
        $hash = hash_file('sha256', $path);
        $signature = file_get_contents($path, false, null, 0, 3);
        $dimensions = @getimagesize($path);
        if (!is_int($size) || $size < 1 || !is_string($hash) || $signature !== "\xFF\xD8\xFF"
            || !is_array($dimensions) || ($dimensions[2] ?? null) !== IMAGETYPE_JPEG
            || (int) $dimensions[0] !== (int) $dimensions[1] || (int) $dimensions[0] > self::MAX_DIMENSION) {
            throw new RuntimeException('Memory image is invalid.');
        }
        return ['path' => $path, 'size' => $size, 'sha256' => $hash];
    }

    private function resolve(string $logicalPath, bool $mustExist): ?string
    {
        if (preg_match('#^\d{4}/\d{2}/[a-f0-9]{40}\.jpg$#D', $logicalPath) !== 1) {
            throw new RuntimeException('Invalid memory image path.');
        }
        $candidate = $this->root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $logicalPath);
        if (!is_file($candidate)) return $mustExist ? null : null;
        $root = realpath($this->root);
        $path = realpath($candidate);
        if ($root === false || $path === false || !str_starts_with($path, $root . DIRECTORY_SEPARATOR)) {
            throw new RuntimeException('Invalid memory image path.');
        }
        return $path;
    }

    private function invalid(string $message): MemoryValidationException
    {
        return new MemoryValidationException(['image' => [$message]]);
    }
}

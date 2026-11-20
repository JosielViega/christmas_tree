<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\GiftDraftValidationException;
use finfo;
use RuntimeException;

final class GiftTextureStorage
{
    public const MAX_DIMENSION = 512;

    public function __construct(
        private readonly string $root,
        private readonly int $maxBytes = 2097152,
    ) {
    }

    /** @param array<string, mixed> $upload */
    public function store(array $upload): StoredGiftTexture
    {
        if (!extension_loaded('gd') || !function_exists('imagecreatefrompng')) {
            throw new RuntimeException('GD with PNG support is required for gift texture processing.');
        }
        $error = (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE);
        $temporaryPath = is_string($upload['tmp_name'] ?? null) ? $upload['tmp_name'] : '';
        $size = (int) ($upload['size'] ?? 0);
        if ($error !== UPLOAD_ERR_OK || $temporaryPath === '' || !is_file($temporaryPath)) {
            throw $this->invalid('Envie uma textura PNG válida.');
        }
        if ($size < 1 || $size > $this->maxBytes) {
            throw $this->invalid('A textura excede o tamanho permitido.');
        }

        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($temporaryPath);
        $signature = file_get_contents($temporaryPath, false, null, 0, 8);
        if ($mime !== 'image/png' || $signature !== "\x89PNG\r\n\x1a\n") {
            throw $this->invalid('A textura deve ser um PNG válido.');
        }
        $dimensions = @getimagesize($temporaryPath);
        if (!is_array($dimensions) || ($dimensions[2] ?? null) !== IMAGETYPE_PNG) {
            throw $this->invalid('Não foi possível decodificar a textura.');
        }
        $width = (int) $dimensions[0];
        $height = (int) $dimensions[1];
        if ($width < 1 || $height < 1 || $width > self::MAX_DIMENSION || $height > self::MAX_DIMENSION
            || $width * $height > self::MAX_DIMENSION * self::MAX_DIMENSION) {
            throw $this->invalid('A textura deve ter no máximo 512×512 pixels.');
        }

        $source = @imagecreatefrompng($temporaryPath);
        if ($source === false) {
            throw $this->invalid('Não foi possível decodificar a textura.');
        }
        $normalized = imagecreatetruecolor($width, $height);
        if ($normalized === false) {
            throw new RuntimeException('Unable to allocate the normalized gift texture.');
        }
        imagealphablending($normalized, false);
        imagesavealpha($normalized, true);
        $transparent = imagecolorallocatealpha($normalized, 0, 0, 0, 127);
        imagefill($normalized, 0, 0, $transparent);
        imagecopy($normalized, $source, 0, 0, 0, 0, $width, $height);

        $relativeDirectory = gmdate('Y/m');
        $directory = $this->root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativeDirectory);
        $this->ensureDirectory($directory);
        $filename = bin2hex(random_bytes(20)) . '.png';
        $logicalPath = $relativeDirectory . '/' . $filename;
        $finalPath = $directory . DIRECTORY_SEPARATOR . $filename;
        $temporaryOutput = $directory . DIRECTORY_SEPARATOR . '.' . $filename . '.tmp';
        try {
            if (!imagepng($normalized, $temporaryOutput, 8) || !rename($temporaryOutput, $finalPath)) {
                throw new RuntimeException('Unable to persist the normalized gift texture.');
            }
            chmod($finalPath, 0640);
        } finally {
            if (is_file($temporaryOutput)) {
                unlink($temporaryOutput);
            }
        }

        return new StoredGiftTexture($logicalPath, hash_file('sha256', $finalPath));
    }

    public function delete(string $logicalPath): bool
    {
        if ($logicalPath === '') {
            return true;
        }
        if (preg_match('#^\d{4}/\d{2}/[a-f0-9]{40}\.png$#D', $logicalPath) !== 1) {
            throw new RuntimeException('Refusing to delete an invalid gift texture path.');
        }
        $path = $this->root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $logicalPath);
        return !is_file($path) || unlink($path);
    }

    private function ensureDirectory(string $directory): void
    {
        if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
            throw new RuntimeException('Unable to initialize private gift storage.');
        }
    }

    private function invalid(string $message): GiftDraftValidationException
    {
        return new GiftDraftValidationException(['texture' => [$message]]);
    }
}

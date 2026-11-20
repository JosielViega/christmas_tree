<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\ChristmasTreeMemory;
use App\Domain\MemoryValidationException;
use App\Repositories\ChristmasTreeMemoryRepository;
use DateTimeImmutable;
use DateTimeZone;
use Throwable;

final class ChristmasTreeMemoryService
{
    public function __construct(
        private readonly ChristmasTreeIdentityService $trees,
        private readonly ChristmasTreeMemoryRepository $memories,
        private readonly MemoryImageStorage $storage,
        private readonly int $capacity = 6,
    ) {
    }

    /** @return list<ChristmasTreeMemory>|null */
    public function list(string $treePublicId): ?array
    {
        $tree = $this->trees->findPublic($treePublicId);
        return $tree === null ? null : $this->memories->forTree($tree->id);
    }

    /** @param array<string, mixed> $upload */
    public function create(string $treePublicId, string $caption, array $upload): ?ChristmasTreeMemory
    {
        $tree = $this->trees->findPublic($treePublicId);
        if ($tree === null) return null;
        $normalizedCaption = $this->caption($caption);
        $stored = $this->storage->store($upload);
        $now = $this->now();
        try {
            return $this->memories->createInAvailableSlot($tree->id, [
                'public_id' => $this->token(12), 'layout_version' => 1, 'caption' => $normalizedCaption,
                'image_path' => $stored->logicalPath, 'created_at' => $now, 'updated_at' => $now,
            ], $this->capacity);
        } catch (Throwable $exception) {
            $this->storage->delete($stored->logicalPath);
            throw $exception;
        }
    }

    /** @param array<string, mixed>|null $upload */
    public function update(string $treePublicId, string $memoryPublicId, string $caption, ?array $upload): ?ChristmasTreeMemory
    {
        $tree = $this->trees->findPublic($treePublicId);
        if ($tree === null) return null;
        $normalizedCaption = $this->caption($caption);
        $stored = $upload !== null && (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE
            ? $this->storage->store($upload) : null;
        try {
            $updated = $this->memories->updateInTree($tree->id, $memoryPublicId, [
                'caption' => $normalizedCaption, 'image_path' => $stored?->logicalPath, 'updated_at' => $this->now(),
            ]);
        } catch (Throwable $exception) {
            if ($stored !== null) $this->storage->delete($stored->logicalPath);
            throw $exception;
        }
        if ($updated === null) {
            if ($stored !== null) $this->storage->delete($stored->logicalPath);
            return null;
        }
        if ($stored !== null && $updated['old_image_path'] !== $stored->logicalPath) {
            $this->storage->delete($updated['old_image_path']);
        }
        return $updated['memory'];
    }

    public function delete(string $treePublicId, string $memoryPublicId): bool
    {
        $tree = $this->trees->findPublic($treePublicId);
        if ($tree === null) return false;
        $path = $this->memories->deleteFromTree($tree->id, $memoryPublicId);
        if ($path === null) return false;
        $this->storage->delete($path);
        return true;
    }

    /** @return null|array{path: string, size: int, sha256: string} */
    public function image(string $treePublicId, string $memoryPublicId): ?array
    {
        $tree = $this->trees->findPublic($treePublicId);
        if ($tree === null) return null;
        $memory = $this->memories->findInTree($tree->id, $memoryPublicId);
        return $memory === null ? null : $this->storage->inspect($memory->imagePath);
    }

    private function caption(string $caption): ?string
    {
        if (preg_match('//u', $caption) !== 1) {
            throw new MemoryValidationException(['caption' => ['A legenda contém texto inválido.']]);
        }
        $caption = trim(preg_replace('/\s+/u', ' ', $caption) ?? '');
        if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', $caption) === 1 || mb_strlen($caption) > 80) {
            throw new MemoryValidationException(['caption' => ['A legenda deve ter no máximo 80 caracteres.']]);
        }
        return $caption === '' ? null : $caption;
    }

    private function now(): string
    {
        return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s.u');
    }

    private function token(int $bytes): string
    {
        return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
    }
}

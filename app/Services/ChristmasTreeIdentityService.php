<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\ChristmasTree;
use App\Domain\TreeCreation;
use App\Domain\TreeValidationException;
use App\Repositories\ChristmasTreeRepository;
use App\Repositories\DuplicatePublicId;
use Closure;
use RuntimeException;

final class ChristmasTreeIdentityService
{
    private const MAX_PUBLIC_ID_ATTEMPTS = 5;
    private const OWNER_NAME_MIN = 2;
    private const OWNER_NAME_MAX = 60;

    /** @var Closure(int): string */
    private readonly Closure $randomToken;

    /** @param null|callable(int): string $randomToken */
    public function __construct(
        private readonly ChristmasTreeRepository $trees,
        ?callable $randomToken = null,
    ) {
        $this->randomToken = $randomToken === null
            ? static fn (int $bytes): string => self::base64Url(random_bytes($bytes))
            : Closure::fromCallable($randomToken);
    }

    public function create(string $ownerName): TreeCreation
    {
        $ownerName = $this->normalizeOwnerName($ownerName);
        $this->validateOwnerName($ownerName);

        $adminToken = ($this->randomToken)(32);
        $recoveryCode = ($this->randomToken)(32);
        $now = $this->now();

        for ($attempt = 0; $attempt < self::MAX_PUBLIC_ID_ATTEMPTS; $attempt++) {
            $publicId = ($this->randomToken)(9);
            if (!$this->isValidPublicId($publicId) || $this->trees->publicIdExists($publicId)) {
                continue;
            }

            try {
                $tree = $this->trees->create([
                    'public_id' => $publicId,
                    'owner_name' => $ownerName,
                    'theme' => 'classic',
                    'status' => 'active',
                    'admin_token_hash' => $this->tokenHash($adminToken),
                    'recovery_token_hash' => $this->tokenHash($recoveryCode),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                return new TreeCreation($tree, $adminToken, $recoveryCode);
            } catch (DuplicatePublicId) {
                continue;
            }
        }

        throw new RuntimeException('Unable to allocate a unique public tree ID.');
    }

    public function findPublic(string $publicId): ?ChristmasTree
    {
        if (!$this->isValidPublicId($publicId)) {
            return null;
        }

        return $this->trees->findPublic($publicId);
    }

    public function ownerIsAuthorized(string $publicId, ?string $adminToken): bool
    {
        if (!$this->isValidPublicId($publicId) || !is_string($adminToken) || $adminToken === '') {
            return false;
        }

        $record = $this->trees->findForAccess($publicId);

        return $record !== null && hash_equals($record->adminTokenHash, $this->tokenHash($adminToken));
    }

    public function recover(string $publicId, string $recoveryCode): ?TreeCreation
    {
        if (!$this->isValidPublicId($publicId) || strlen($recoveryCode) < 32 || strlen($recoveryCode) > 128) {
            return null;
        }

        $record = $this->trees->findForAccess($publicId);
        if ($record === null || !hash_equals($record->recoveryTokenHash, $this->tokenHash($recoveryCode))) {
            return null;
        }

        $newAdminToken = ($this->randomToken)(32);
        $newRecoveryCode = ($this->randomToken)(32);
        $updatedAt = $this->now();
        $rotated = $this->trees->rotateCredentials(
            $record->tree->id,
            $record->recoveryTokenHash,
            $this->tokenHash($newAdminToken),
            $this->tokenHash($newRecoveryCode),
            $updatedAt,
        );
        if (!$rotated) {
            return null;
        }

        $tree = new ChristmasTree(
            $record->tree->id,
            $record->tree->publicId,
            $record->tree->ownerName,
            $record->tree->theme,
            $record->tree->status,
            $record->tree->createdAt,
            $updatedAt,
        );

        return new TreeCreation($tree, $newAdminToken, $newRecoveryCode);
    }

    public function isValidPublicId(string $publicId): bool
    {
        return preg_match('/^[A-Za-z0-9_-]{12}$/D', $publicId) === 1;
    }

    private function normalizeOwnerName(string $ownerName): string
    {
        $normalized = preg_replace('/\s+/u', ' ', trim($ownerName));

        return is_string($normalized) ? $normalized : '';
    }

    private function validateOwnerName(string $ownerName): void
    {
        $length = mb_strlen($ownerName, 'UTF-8');
        $errors = [];

        if ($length < self::OWNER_NAME_MIN) {
            $errors['owner_name'][] = 'Informe um nome com pelo menos 2 caracteres.';
        }
        if ($length > self::OWNER_NAME_MAX) {
            $errors['owner_name'][] = 'O nome pode ter no máximo 60 caracteres.';
        }
        if ($ownerName !== '' && preg_match('/[\p{C}]/u', $ownerName) === 1) {
            $errors['owner_name'][] = 'O nome contém caracteres não permitidos.';
        }

        if ($errors !== []) {
            throw new TreeValidationException($errors);
        }
    }

    private function tokenHash(string $token): string
    {
        return hash('sha256', $token);
    }

    private function now(): string
    {
        return gmdate('Y-m-d H:i:s') . '.000000';
    }

    private static function base64Url(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }
}

<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\ChristmasTreeOrnament;
use App\Domain\OrnamentCreation;
use App\Domain\OrnamentValidationException;
use App\Repositories\ChristmasTreeOrnamentRepository;
use App\Repositories\ChristmasTreeRepository;

final class ChristmasTreeOrnamentService
{
    public const TYPES = [
        'bauble_red' => '#d9342b',
        'bauble_gold' => '#f2c94c',
        'bauble_blue' => '#2878d0',
        'heart' => '#e94b68',
        'star' => '#fff1a1',
        'present' => '#2fa866',
    ];

    public function __construct(
        private readonly ChristmasTreeRepository $trees,
        private readonly ChristmasTreeOrnamentRepository $ornaments,
        private readonly int $configuredCapacity = OrnamentLayout::SLOT_COUNT,
    ) {
    }

    public function capacity(): int
    {
        return max(1, min(OrnamentLayout::SLOT_COUNT, $this->configuredCapacity));
    }

    /** @return null|list<ChristmasTreeOrnament> */
    public function list(string $treePublicId): ?array
    {
        $tree = $this->trees->findPublic($treePublicId);

        return $tree === null ? null : $this->ornaments->forTree($tree->id);
    }

    public function create(string $treePublicId, string $type, string $senderName, string $idempotencyKey): ?OrnamentCreation
    {
        $tree = $this->trees->findPublic($treePublicId);
        if ($tree === null) {
            return null;
        }

        $senderName = $this->normalizeName($senderName);
        $errors = [];
        if (!array_key_exists($type, self::TYPES)) {
            $errors['ornament_type'][] = 'Escolha um enfeite válido.';
        }
        $length = mb_strlen($senderName, 'UTF-8');
        if ($length < 2 || $length > 40 || preg_match('/[\p{C}]/u', $senderName) === 1) {
            $errors['sender_name'][] = 'Informe um nome entre 2 e 40 caracteres.';
        }
        if (preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $idempotencyKey) !== 1) {
            $errors['idempotency_key'][] = 'A chave de envio é inválida.';
        }
        if ($errors !== []) {
            throw new OrnamentValidationException($errors);
        }

        return $this->ornaments->createInAvailableSlot($tree->id, [
            'public_id' => self::randomPublicId(),
            'ornament_type' => $type,
            'ornament_color' => self::TYPES[$type],
            'sender_name' => $senderName,
            'layout_version' => OrnamentLayout::VERSION,
            'idempotency_key_hash' => hash('sha256', $idempotencyKey),
            'created_at' => gmdate('Y-m-d H:i:s') . '.000000',
        ], $this->capacity());
    }

    public function delete(string $treePublicId, string $ornamentPublicId): ?bool
    {
        $tree = $this->trees->findPublic($treePublicId);
        if ($tree === null) {
            return null;
        }
        if (preg_match('/^[A-Za-z0-9_-]{12}$/D', $ornamentPublicId) !== 1) {
            return false;
        }

        return $this->ornaments->deleteFromTree($tree->id, $ornamentPublicId);
    }

    private function normalizeName(string $name): string
    {
        $normalized = preg_replace('/\s+/u', ' ', trim($name));

        return is_string($normalized) ? $normalized : '';
    }

    private static function randomPublicId(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(9)), '+/', '-_'), '=');
    }
}

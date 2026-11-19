<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\ChristmasTree;
use App\Domain\ChristmasTreeOrnament;
use App\Domain\OrnamentCreation;
use App\Domain\OrnamentValidationException;
use App\Domain\TreeMessageOverview;
use App\Repositories\ChristmasTreeOrnamentRepository;
use App\Repositories\ChristmasTreeRepository;
use Closure;
use DateTimeImmutable;
use DateTimeZone;

final class ChristmasTreeOrnamentService
{
    private readonly Closure $clock;
    private readonly DateTimeImmutable $revealAt;

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
        string $revealAt = '2026-12-25 00:00:00',
        string $revealTimezone = 'America/Sao_Paulo',
        ?callable $clock = null,
    ) {
        $this->revealAt = new DateTimeImmutable($revealAt, new DateTimeZone($revealTimezone));
        $this->clock = $clock === null
            ? static fn (): DateTimeImmutable => new DateTimeImmutable('now', new DateTimeZone('UTC'))
            : Closure::fromCallable($clock);
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

    public function create(string $treePublicId, string $type, string $senderName, string $idempotencyKey, string $secretMessage): ?OrnamentCreation
    {
        $tree = $this->trees->findPublic($treePublicId);
        if ($tree === null) {
            return null;
        }

        $senderName = $this->normalizeName($senderName);
        $secretMessage = $this->normalizeMessage($secretMessage);
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
        $messageLength = mb_strlen($secretMessage, 'UTF-8');
        if ($messageLength < 2) {
            $errors['message'][] = 'Escreva uma mensagem com pelo menos 2 caracteres.';
        }
        if ($messageLength > 500) {
            $errors['message'][] = 'A mensagem pode ter no máximo 500 caracteres.';
        }
        if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]|\p{Cf}/u', $secretMessage) === 1) {
            $errors['message'][] = 'A mensagem contém caracteres não permitidos.';
        }
        if ($errors !== []) {
            throw new OrnamentValidationException($errors);
        }

        $payloadHash = hash('sha256', json_encode(
            ['ornament_type' => $type, 'sender_name' => $senderName, 'message' => $secretMessage],
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        ));

        return $this->ornaments->createInAvailableSlot($tree->id, [
            'public_id' => self::randomPublicId(),
            'ornament_type' => $type,
            'ornament_color' => self::TYPES[$type],
            'sender_name' => $senderName,
            'secret_message' => $secretMessage,
            'message_payload_hash' => $payloadHash,
            'layout_version' => OrnamentLayout::VERSION,
            'idempotency_key_hash' => hash('sha256', $idempotencyKey),
            'created_at' => gmdate('Y-m-d H:i:s') . '.000000',
        ], $this->capacity());
    }

    public function messageOverview(string $treePublicId): ?TreeMessageOverview
    {
        $tree = $this->trees->findPublic($treePublicId);
        if ($tree === null) {
            return null;
        }

        return $this->messageOverviewForTree($tree);
    }

    public function messageOverviewForTree(ChristmasTree $tree): TreeMessageOverview
    {

        $revealed = ($this->clock)() >= $this->revealAt;

        return new TreeMessageOverview(
            $this->ornaments->messageCountForTree($tree->id),
            $revealed,
            $this->revealAt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z'),
            $revealed ? $this->ornaments->privateMessagesForTree($tree->id) : [],
        );
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

    private function normalizeMessage(string $message): string
    {
        return trim(str_replace(["\r\n", "\r"], "\n", $message));
    }

    private static function randomPublicId(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(9)), '+/', '-_'), '=');
    }
}

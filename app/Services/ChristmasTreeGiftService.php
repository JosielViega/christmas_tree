<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\GiftDraft;
use App\Domain\GiftDraftCreation;
use App\Domain\GiftDraftStatus;
use App\Domain\GiftDraftValidationException;
use App\Domain\IdempotencyConflict;
use App\Repositories\ChristmasTreeGiftRepository;
use App\Repositories\ChristmasTreeRepository;
use Closure;
use DateTimeImmutable;
use DateTimeZone;

final class ChristmasTreeGiftService
{
    public const STYLES = ['classic', 'magic', 'romantic'];
    public const MODES = ['repeated', 'featured'];
    private readonly Closure $clock;

    public function __construct(
        private readonly ChristmasTreeRepository $trees,
        private readonly ChristmasTreeGiftRepository $gifts,
        private readonly GiftTextureStorage $storage,
        private readonly int $expirationHours = 24,
        ?callable $clock = null,
    ) {
        $this->clock = $clock === null
            ? static fn (): DateTimeImmutable => new DateTimeImmutable('now', new DateTimeZone('UTC'))
            : Closure::fromCallable($clock);
    }

    /** @param array<string, mixed> $texture */
    public function create(
        string $treePublicId,
        string $senderName,
        string $style,
        string $mode,
        string $message,
        string $idempotencyKey,
        bool $publicationConsent,
        array $texture,
    ): ?GiftDraftCreation {
        $tree = $this->trees->findPublic($treePublicId);
        if ($tree === null) {
            return null;
        }
        $senderName = $this->normalizeName($senderName);
        $message = $this->normalizeMessage($message);
        $this->validate($senderName, $style, $mode, $message, $idempotencyKey, $publicationConsent);

        $inputHash = is_string($texture['tmp_name'] ?? null) && is_file($texture['tmp_name'])
            ? hash_file('sha256', $texture['tmp_name'])
            : '';
        $payloadHash = hash('sha256', json_encode([
            'sender_name' => $senderName,
            'gift_style' => $style,
            'composition_mode' => $mode,
            'message' => $message,
            'texture_hash' => $inputHash,
            'publication_consent' => true,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $stored = $this->storage->store($texture);
        $accessToken = $this->randomToken(32);
        $now = ($this->clock)();
        try {
            $persistence = $this->gifts->createOrFind($tree->id, [
                'public_id' => $this->randomPublicId(),
                'sender_name' => $senderName,
                'gift_style' => $style,
                'composition_mode' => $mode,
                'message' => $message,
                'texture_path' => $stored->logicalPath,
                'texture_sha256' => $stored->contentHash,
                'status' => GiftDraftStatus::DRAFT,
                'idempotency_key_hash' => hash('sha256', $idempotencyKey),
                'payload_hash' => $payloadHash,
                'access_token_hash' => hash('sha256', $accessToken),
                'created_at' => $this->format($now),
                'expires_at' => $this->format($now->modify('+' . max(1, $this->expirationHours) . ' hours')),
            ]);
        } catch (\Throwable $exception) {
            $this->storage->delete($stored->logicalPath);
            throw $exception;
        }
        if (!$persistence->created) {
            $this->storage->delete($stored->logicalPath);
            return new GiftDraftCreation($persistence->record->gift, false, null);
        }
        return new GiftDraftCreation($persistence->record->gift, true, $accessToken);
    }

    public function findAuthorized(string $publicId, string $accessToken): ?GiftDraft
    {
        $record = $this->authorizedRecord($publicId, $accessToken);
        if ($record === null) {
            return null;
        }
        return $this->expireIfNecessary($record->gift, $record->texturePath);
    }

    public function findAuthorizedById(int $giftId): ?GiftDraft
    {
        return $this->gifts->findById($giftId)?->gift;
    }

    public function recipientTreeIdForAccess(string $publicId, string $accessToken): ?int
    {
        return $this->authorizedRecord($publicId, $accessToken)?->gift->treeId;
    }

    public function cancel(string $publicId, string $accessToken): ?GiftDraft
    {
        $record = $this->authorizedRecord($publicId, $accessToken);
        if ($record === null) {
            return null;
        }
        $gift = $this->expireIfNecessary($record->gift, $record->texturePath);
        if ($gift->status === GiftDraftStatus::DRAFT
            && GiftDraftStatus::canTransition($gift->status, GiftDraftStatus::CANCELLED)
            && $this->gifts->transition($publicId, GiftDraftStatus::DRAFT, GiftDraftStatus::CANCELLED, $this->format(($this->clock)()))) {
            $this->removeTexture($publicId, $record->texturePath);
            return $this->withStatus($gift, GiftDraftStatus::CANCELLED);
        }
        return $gift;
    }

    public function cleanupExpired(int $limit = 100): int
    {
        $now = $this->format(($this->clock)());
        $cleaned = 0;
        foreach ($this->gifts->cleanupCandidates($now, $limit) as $record) {
            $status = $record->gift->status;
            if ($status === GiftDraftStatus::DRAFT) {
                if (!$this->gifts->transition($record->gift->publicId, GiftDraftStatus::DRAFT, GiftDraftStatus::EXPIRED, $now)) {
                    continue;
                }
                $status = GiftDraftStatus::EXPIRED;
            }
            if (in_array($status, [GiftDraftStatus::CANCELLED, GiftDraftStatus::EXPIRED], true)) {
                $this->removeTexture($record->gift->publicId, $record->texturePath);
                $cleaned++;
            }
        }
        return $cleaned;
    }

    private function validate(string $name, string $style, string $mode, string $message, string $key, bool $consent): void
    {
        $errors = [];
        $nameLength = mb_strlen($name, 'UTF-8');
        if ($nameLength < 2 || $nameLength > 40 || preg_match('/[\p{C}]/u', $name) === 1) {
            $errors['sender_name'][] = 'Informe um nome entre 2 e 40 caracteres.';
        }
        if (!in_array($style, self::STYLES, true)) {
            $errors['gift_style'][] = 'Escolha um estilo válido.';
        }
        if (!in_array($mode, self::MODES, true)) {
            $errors['composition_mode'][] = 'Escolha um modo de composição válido.';
        }
        $messageLength = mb_strlen($message, 'UTF-8');
        if ($messageLength < 2 || $messageLength > 500
            || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]|\p{Cf}/u', $message) === 1) {
            $errors['message'][] = 'Escreva uma mensagem entre 2 e 500 caracteres válidos.';
        }
        if (preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $key) !== 1) {
            $errors['idempotency_key'][] = 'A chave de envio é inválida.';
        }
        if (!$consent) {
            $errors['publication_consent'][] = 'Confirme que a fotografia poderá ficar pública após uma futura publicação paga.';
        }
        if ($errors !== []) {
            throw new GiftDraftValidationException($errors);
        }
    }

    private function authorizedRecord(string $publicId, string $token): ?\App\Domain\GiftDraftRecord
    {
        if (preg_match('/^[A-Za-z0-9_-]{16}$/D', $publicId) !== 1 || strlen($token) < 32 || strlen($token) > 128) {
            return null;
        }
        $record = $this->gifts->findForAccess($publicId);
        return $record !== null && hash_equals($record->accessTokenHash, hash('sha256', $token)) ? $record : null;
    }

    private function expireIfNecessary(GiftDraft $gift, string $texturePath): GiftDraft
    {
        $now = ($this->clock)();
        if ($gift->status === GiftDraftStatus::DRAFT && new DateTimeImmutable($gift->expiresAt, new DateTimeZone('UTC')) <= $now
            && GiftDraftStatus::canTransition($gift->status, GiftDraftStatus::EXPIRED)
            && $this->gifts->transition($gift->publicId, GiftDraftStatus::DRAFT, GiftDraftStatus::EXPIRED, $this->format($now))) {
            $this->removeTexture($gift->publicId, $texturePath);
            return $this->withStatus($gift, GiftDraftStatus::EXPIRED);
        }
        return $gift;
    }

    private function removeTexture(string $publicId, string $path): void
    {
        if ($this->storage->delete($path)) {
            $this->gifts->clearTexturePath($publicId);
        }
    }

    private function withStatus(GiftDraft $gift, string $status): GiftDraft
    {
        return new GiftDraft($gift->id, $gift->treeId, $gift->publicId, $gift->senderName, $gift->giftStyle, $gift->compositionMode, $status, $gift->createdAt, $gift->expiresAt);
    }

    private function normalizeName(string $value): string
    {
        $normalized = preg_replace('/\s+/u', ' ', trim($value));
        return is_string($normalized) ? $normalized : '';
    }

    private function normalizeMessage(string $value): string
    {
        return trim(str_replace(["\r\n", "\r"], "\n", $value));
    }

    private function randomPublicId(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(12)), '+/', '-_'), '=');
    }

    private function randomToken(int $bytes): string
    {
        return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
    }

    private function format(DateTimeImmutable $date): string
    {
        return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
    }
}

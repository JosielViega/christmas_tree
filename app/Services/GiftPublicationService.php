<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\PublishedGift;
use App\Repositories\ChristmasTreeGiftRepository;
use App\Repositories\ChristmasTreeRepository;
use App\Repositories\GiftPublicationRepository;
use Closure;
use DateTimeImmutable;
use DateTimeZone;
use RuntimeException;

final class GiftPublicationService
{
    public const LAYOUT_VERSION = 1;
    public const VISIBLE_LIMIT = 12;
    private readonly Closure $clock;
    private readonly DateTimeImmutable $revealAt;

    public function __construct(
        private readonly ChristmasTreeRepository $trees,
        private readonly ChristmasTreeGiftRepository $drafts,
        private readonly GiftPublicationRepository $publications,
        private readonly GiftTextureStorage $storage,
        string $revealAt = '2026-12-25 00:00:00',
        string $revealTimezone = 'America/Sao_Paulo',
        ?callable $clock = null,
    ) {
        $this->revealAt = new DateTimeImmutable($revealAt, new DateTimeZone($revealTimezone));
        $this->clock = $clock === null
            ? static fn (): DateTimeImmutable => new DateTimeImmutable('now', new DateTimeZone('UTC'))
            : Closure::fromCallable($clock);
    }

    public function publish(string $giftPublicId): ?PublishedGift
    {
        $record = $this->drafts->findForAccess($giftPublicId);
        if ($record === null) {
            return null;
        }
        if (!in_array($record->gift->status, ['paid', 'published'], true)) {
            throw new RuntimeException('Only paid gifts can be published.');
        }
        $texture = $this->storage->inspect($record->texturePath);
        return $this->publications->publish($giftPublicId, $texture['sha256'], $this->now(), self::LAYOUT_VERSION);
    }

    public function publishEligible(int $limit = 20): int
    {
        $published = 0;
        foreach ($this->publications->paidGiftIdsForPublication($limit) as $publicId) {
            try {
                if ($this->publish($publicId) !== null) {
                    $published++;
                }
            } catch (RuntimeException) {
                continue;
            }
        }
        return $published;
    }

    /** @return null|list<PublishedGift> */
    public function forTree(string $treePublicId): ?array
    {
        $tree = $this->trees->findPublic($treePublicId);
        return $tree === null ? null : $this->publications->publishedForTree($tree->id);
    }

    /** @return null|array{gift: PublishedGift, path: string, size: int, sha256: string} */
    public function publicTexture(string $giftPublicId): ?array
    {
        if (preg_match('/^[A-Za-z0-9_-]{16}$/D', $giftPublicId) !== 1) {
            return null;
        }
        $gift = $this->publications->findVisiblePublished($giftPublicId);
        if ($gift === null) {
            return null;
        }
        $texture = $this->storage->inspect($gift->texturePath);
        if ($gift->textureSha256 === '' || !hash_equals($gift->textureSha256, $texture['sha256'])) {
            throw new RuntimeException('Published gift texture integrity check failed.');
        }
        return ['gift' => $gift, ...$texture];
    }

    public function hide(string $treePublicId, string $giftPublicId): ?bool
    {
        $tree = $this->trees->findPublic($treePublicId);
        return $tree === null ? null : $this->publications->hide($tree->id, $giftPublicId, $this->now());
    }

    /** @return array{message: string, reveal_at: string}|null */
    public function ownerMessage(string $treePublicId, string $giftPublicId): ?array
    {
        $tree = $this->trees->findPublic($treePublicId);
        if ($tree === null || ($this->clock)() < $this->revealAt) {
            return null;
        }
        $message = $this->publications->revealedMessage($tree->id, $giftPublicId);
        return $message === null ? null : [
            'message' => $message,
            'reveal_at' => $this->revealAt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z'),
        ];
    }

    private function now(): string
    {
        return ($this->clock)()->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
    }
}

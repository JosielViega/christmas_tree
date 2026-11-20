<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Domain\PublishedGift;

interface GiftPublicationRepository
{
    public function publish(string $giftPublicId, string $textureSha256, string $now, int $layoutVersion): ?PublishedGift;

    /** @return list<PublishedGift> */
    public function publishedForTree(int $treeId): array;

    public function findVisiblePublished(string $giftPublicId): ?PublishedGift;

    /** @return list<string> */
    public function paidGiftIdsForPublication(int $limit): array;

    public function hide(int $treeId, string $giftPublicId, string $now): bool;

    public function revealedMessage(int $treeId, string $giftPublicId): ?string;
}

<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Domain\PublishedGift;
use App\Repositories\GiftPublicationRepository;

final class InMemoryGiftPublicationRepository implements GiftPublicationRepository
{
    /** @var array<string, array{tree_id: int, message: string}> */
    public array $messages = [];
    public int $mutationCount = 0;

    public function publish(string $giftPublicId, string $textureSha256, string $now, int $layoutVersion): ?PublishedGift
    {
        $this->mutationCount++;
        return null;
    }

    public function publishedForTree(int $treeId): array { return []; }
    public function findVisiblePublished(string $giftPublicId): ?PublishedGift { return null; }
    public function paidGiftIdsForPublication(int $limit): array { return []; }

    public function hide(int $treeId, string $giftPublicId, string $now): bool
    {
        $this->mutationCount++;
        return false;
    }

    public function revealedMessage(int $treeId, string $giftPublicId): ?string
    {
        $record = $this->messages[$giftPublicId] ?? null;
        return is_array($record) && $record['tree_id'] === $treeId ? $record['message'] : null;
    }
}

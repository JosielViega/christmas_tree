<?php

declare(strict_types=1);

namespace Tests;

use App\Controllers\TreeMemoryApiController;
use App\Core\Csrf;
use App\Core\Database;
use App\Core\Request;
use App\Core\Session;
use App\Repositories\PdoChristmasTreeMemoryRepository;
use App\Repositories\PdoChristmasTreeRepository;
use App\Services\ChristmasTreeIdentityService;
use App\Services\ChristmasTreeMemoryService;
use App\Services\MemoryImageStorage;
use App\Services\RateLimiter;
use App\Services\TreeOwnerSession;
use PHPUnit\Framework\TestCase;

final class PersistedMemoryReloadIntegrationTest extends TestCase
{
    public function testThreePersistedJpegsRemainAvailableThroughReloadedApi(): void
    {
        if (getenv('CHRISTMAS_TREE_MYSQL_INTEGRATION') !== '1') {
            self::markTestSkipped('Set CHRISTMAS_TREE_MYSQL_INTEGRATION=1 to run against an isolated MySQL database.');
        }

        $database = new Database([
            'host' => getenv('DB_HOST') ?: '127.0.0.1',
            'port' => (int) (getenv('DB_PORT') ?: 3306),
            'database' => getenv('DB_DATABASE') ?: '',
            'username' => getenv('DB_USERNAME') ?: '',
            'password' => getenv('DB_PASSWORD') ?: '',
            'charset' => 'utf8mb4',
        ]);
        $pdo = $database->connection();
        $treeId = null;
        $uploads = [];
        $root = sys_get_temp_dir() . '/memory-reload-' . bin2hex(random_bytes(6));

        try {
            $trees = new ChristmasTreeIdentityService(new PdoChristmasTreeRepository($database));
            $created = $trees->create('Árvore técnica de recarregamento');
            $treeId = $created->tree->id;
            $memories = new ChristmasTreeMemoryService(
                $trees,
                new PdoChristmasTreeMemoryRepository($database),
                new MemoryImageStorage($root . '/images'),
            );

            for ($index = 0; $index < 3; $index++) {
                $upload = $this->jpegUpload($index);
                $uploads[] = $upload['tmp_name'];
                $memory = $memories->create($created->tree->publicId, 'Fotografia ' . ($index + 1), $upload);
                self::assertSame($index, $memory?->slotIndex);
            }
            self::assertSame(3, (int) $pdo->query('SELECT COUNT(*) FROM christmas_tree_memories WHERE tree_id = ' . $treeId)->fetchColumn());

            $reloadedTrees = new ChristmasTreeIdentityService(new PdoChristmasTreeRepository($database));
            $reloadedMemories = new ChristmasTreeMemoryService(
                $reloadedTrees,
                new PdoChristmasTreeMemoryRepository($database),
                new MemoryImageStorage($root . '/images'),
            );
            $_SESSION = [];
            $session = new Session(false);
            $controller = new TreeMemoryApiController(
                new Request(),
                new Csrf($session),
                $reloadedTrees,
                $reloadedMemories,
                new TreeOwnerSession($session),
                new RateLimiter($root . '/rate', 100, 900),
                8650752,
            );

            $list = $controller->index($created->tree->publicId);
            self::assertSame(200, $list->status());
            $payload = json_decode($list->body(), true, 512, JSON_THROW_ON_ERROR);
            self::assertCount(3, $payload['data']['memories']);
            foreach ($payload['data']['memories'] as $memory) {
                self::assertStringContainsString('/image', $memory['image_url']);
                $image = $controller->image($created->tree->publicId, $memory['public_id']);
                self::assertSame(200, $image->status());
                self::assertSame('image/jpeg', $image->headers()['Content-Type']);
                self::assertStringStartsWith("\xFF\xD8\xFF", $image->body());
            }
        } finally {
            if (is_int($treeId)) {
                $cleanup = $pdo->prepare('DELETE FROM christmas_trees WHERE id = :id');
                $cleanup->execute(['id' => $treeId]);
            }
            foreach ($uploads as $upload) {
                if (is_file($upload)) unlink($upload);
            }
            $this->removeDirectory($root);
        }
    }

    /** @return array{tmp_name: string, size: int, error: int, name: string, type: string} */
    private function jpegUpload(int $seed): array
    {
        $path = tempnam(sys_get_temp_dir(), 'memory-reload-jpeg-');
        $image = imagecreatetruecolor(160, 120);
        imagefill($image, 0, 0, imagecolorallocate($image, 40 + $seed * 30, 80, 120));
        imagejpeg($image, $path, 88);
        return [
            'tmp_name' => $path,
            'size' => filesize($path),
            'error' => UPLOAD_ERR_OK,
            'name' => 'memory-' . $seed . '.jpg',
            'type' => 'image/jpeg',
        ];
    }

    private function removeDirectory(string $directory): void
    {
        if (!is_dir($directory)) return;
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );
        foreach ($iterator as $item) $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        rmdir($directory);
    }
}

<?php

declare(strict_types=1);

namespace Tests;

use App\Core\Database;
use App\Repositories\PdoChristmasTreeRepository;
use App\Repositories\PdoChristmasTreeOrnamentRepository;
use App\Services\ChristmasTreeIdentityService;
use App\Services\ChristmasTreeOrnamentService;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

final class PdoChristmasTreeRepositoryIntegrationTest extends TestCase
{
    public function testPersistentCreationAuthorizationAndSingleUseRecovery(): void
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

        try {
            $treeRepository = new PdoChristmasTreeRepository($database);
            $service = new ChristmasTreeIdentityService($treeRepository);
            $created = $service->create('Família Integração');
            $treeId = $created->tree->id;

            self::assertSame('Família Integração', $service->findPublic($created->tree->publicId)?->ownerName);
            self::assertTrue($service->ownerIsAuthorized($created->tree->publicId, $created->adminToken));
            self::assertFalse($service->ownerIsAuthorized($created->tree->publicId, 'token-incorreto'));

            $recovered = $service->recover($created->tree->publicId, $created->recoveryCode);
            self::assertNotNull($recovered);
            self::assertFalse($service->ownerIsAuthorized($created->tree->publicId, $created->adminToken));
            self::assertTrue($service->ownerIsAuthorized($created->tree->publicId, $recovered->adminToken));
            self::assertNull($service->recover($created->tree->publicId, $created->recoveryCode));

            $ornaments = new ChristmasTreeOrnamentService($treeRepository, new PdoChristmasTreeOrnamentRepository($database));
            $ornament = $ornaments->create($created->tree->publicId, 'bauble_blue', 'Visitante', str_repeat('i', 16), "Feliz Natal 🎄\nCom carinho");
            self::assertNotNull($ornament);
            self::assertTrue($ornament->created);
            self::assertCount(1, $ornaments->list($created->tree->publicId));

            $repeated = $ornaments->create($created->tree->publicId, 'bauble_blue', 'Visitante', str_repeat('i', 16), "Feliz Natal 🎄\nCom carinho");
            self::assertFalse($repeated->created);
            self::assertSame($ornament->ornament->publicId, $repeated->ornament->publicId);
            $revealedOrnaments = new ChristmasTreeOrnamentService(
                $treeRepository,
                new PdoChristmasTreeOrnamentRepository($database),
                60,
                '2026-12-25 00:00:00',
                'America/Sao_Paulo',
                static fn (): DateTimeImmutable => new DateTimeImmutable('2026-12-25T03:00:00+00:00'),
            );
            $messageOverview = $revealedOrnaments->messageOverview($created->tree->publicId);
            self::assertSame("Feliz Natal 🎄\nCom carinho", $messageOverview->messages[0]->message);
            self::assertTrue($ornaments->delete($created->tree->publicId, $ornament->ornament->publicId));
            self::assertSame([], $ornaments->list($created->tree->publicId));
            self::assertSame(0, $revealedOrnaments->messageOverview($created->tree->publicId)->messageCount);
        } finally {
            if (is_int($treeId)) {
                $cleanup = $pdo->prepare('DELETE FROM christmas_trees WHERE id = :id');
                $cleanup->execute(['id' => $treeId]);
            }
        }
    }
}

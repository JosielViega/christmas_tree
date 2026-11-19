<?php

declare(strict_types=1);

namespace Tests;

use App\Core\Database;
use App\Repositories\PdoChristmasTreeRepository;
use App\Services\ChristmasTreeIdentityService;
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
        $pdo->beginTransaction();

        try {
            $service = new ChristmasTreeIdentityService(new PdoChristmasTreeRepository($database));
            $created = $service->create('Família Integração');

            self::assertSame('Família Integração', $service->findPublic($created->tree->publicId)?->ownerName);
            self::assertTrue($service->ownerIsAuthorized($created->tree->publicId, $created->adminToken));
            self::assertFalse($service->ownerIsAuthorized($created->tree->publicId, 'token-incorreto'));

            $recovered = $service->recover($created->tree->publicId, $created->recoveryCode);
            self::assertNotNull($recovered);
            self::assertFalse($service->ownerIsAuthorized($created->tree->publicId, $created->adminToken));
            self::assertTrue($service->ownerIsAuthorized($created->tree->publicId, $recovered->adminToken));
            self::assertNull($service->recover($created->tree->publicId, $created->recoveryCode));
        } finally {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
        }
    }
}

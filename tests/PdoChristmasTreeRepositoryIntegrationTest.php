<?php

declare(strict_types=1);

namespace Tests;

use App\Core\Database;
use App\Repositories\PdoChristmasTreeRepository;
use App\Repositories\PdoChristmasTreeOrnamentRepository;
use App\Repositories\PdoChristmasTreeGiftRepository;
use App\Repositories\PdoPaymentOrderRepository;
use App\Services\ChristmasTreeGiftService;
use App\Services\ChristmasTreeIdentityService;
use App\Services\ChristmasTreeOrnamentService;
use App\Services\GiftTextureStorage;
use App\Services\GiftPaymentService;
use App\Services\GiftProductCatalog;
use App\Domain\PaymentCharge;
use Tests\Support\FakePaymentGateway;
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
        $giftStorage = null;
        $giftUpload = null;

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

            $giftStorage = sys_get_temp_dir() . '/gift-mysql-' . bin2hex(random_bytes(5));
            $giftUpload = tempnam(sys_get_temp_dir(), 'gift-mysql-png-');
            $image = imagecreatetruecolor(64, 64);
            imagepng($image, $giftUpload);
            $upload = ['tmp_name' => $giftUpload, 'size' => filesize($giftUpload), 'error' => UPLOAD_ERR_OK, 'name' => 'texture.png', 'type' => 'image/png'];
            $gifts = new ChristmasTreeGiftService(
                $treeRepository,
                new PdoChristmasTreeGiftRepository($database),
                new GiftTextureStorage($giftStorage),
            );
            $gift = $gifts->create($created->tree->publicId, 'Visitante', 'classic', 'repeated', 'Mensagem privada', str_repeat('g', 16), true, $upload);
            self::assertTrue($gift->created);
            self::assertSame('draft', $gifts->findAuthorized($gift->gift->publicId, $gift->accessToken)?->status);
            $repeatedGift = $gifts->create($created->tree->publicId, 'Visitante', 'classic', 'repeated', 'Mensagem privada', str_repeat('g', 16), true, $upload);
            self::assertFalse($repeatedGift->created);
            self::assertSame($gift->gift->publicId, $repeatedGift->gift->publicId);
            self::assertSame('cancelled', $gifts->cancel($gift->gift->publicId, $gift->accessToken)?->status);

            $paidGift = $gifts->create($created->tree->publicId, 'Pagador', 'magic', 'featured', 'Mensagem paga', str_repeat('h', 16), true, $upload);
            $gateway = new FakePaymentGateway();
            $payments = new GiftPaymentService(
                $gifts,
                new PdoPaymentOrderRepository($database),
                new GiftProductCatalog(['special' => 199, 'personalized' => 399, 'magic' => 599], 'integration'),
                $gateway,
                60,
                false,
            );
            $order = $payments->create($paidGift->gift->publicId, $paidGift->accessToken, 'magic', 'payer@example.com', str_repeat('j', 16));
            self::assertSame(599, $order?->amountCents);
            self::assertSame('pending', $order?->status);
            self::assertSame('draft', $gifts->cancel($paidGift->gift->publicId, $paidGift->accessToken)?->status);
            $gateway->charge = new PaymentCharge(
                (string) $order?->providerOrderId, 'PAY_INTEGRATION', (string) $order?->publicId,
                599, 'BRL', 'paid', false, null, null, null,
            );
            self::assertTrue($payments->processNotification('signed', 'request', (string) $order?->providerOrderId, '{"id":"integration"}'));
            self::assertTrue($payments->processNotification('signed', 'request', (string) $order?->providerOrderId, '{"id":"integration"}'));
            self::assertSame('paid', $payments->findAuthorized($paidGift->gift->publicId, $paidGift->accessToken)?->status);
            self::assertSame(1, (int) $pdo->query('SELECT COUNT(*) FROM christmas_tree_payment_events')->fetchColumn());
            self::assertSame('paid', $pdo->query("SELECT status FROM christmas_tree_gifts WHERE id = {$paidGift->gift->id}")->fetchColumn());
            self::assertSame(0, (int) $pdo->query("SELECT COUNT(*) FROM christmas_tree_gifts WHERE id = {$paidGift->gift->id} AND published_at IS NOT NULL")->fetchColumn());
        } finally {
            if (is_int($treeId)) {
                $pdo->exec('DELETE payment_events FROM christmas_tree_payment_events payment_events INNER JOIN christmas_tree_gift_orders gift_orders ON gift_orders.id = payment_events.order_id INNER JOIN christmas_tree_gifts gifts ON gifts.id = gift_orders.gift_id WHERE gifts.tree_id = ' . $treeId);
                $pdo->exec('DELETE gift_orders FROM christmas_tree_gift_orders gift_orders INNER JOIN christmas_tree_gifts gifts ON gifts.id = gift_orders.gift_id WHERE gifts.tree_id = ' . $treeId);
                $cleanup = $pdo->prepare('DELETE FROM christmas_trees WHERE id = :id');
                $cleanup->execute(['id' => $treeId]);
            }
            if (is_string($giftUpload) && is_file($giftUpload)) {
                unlink($giftUpload);
            }
            if (is_string($giftStorage) && is_dir($giftStorage)) {
                $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($giftStorage, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
                foreach ($iterator as $item) $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
                rmdir($giftStorage);
            }
        }
    }
}

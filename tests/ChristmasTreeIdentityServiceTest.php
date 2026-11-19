<?php

declare(strict_types=1);

namespace Tests;

use App\Domain\TreeValidationException;
use App\Services\ChristmasTreeIdentityService;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryChristmasTreeRepository;

final class ChristmasTreeIdentityServiceTest extends TestCase
{
    private InMemoryChristmasTreeRepository $repository;
    private ChristmasTreeIdentityService $service;

    protected function setUp(): void
    {
        $this->repository = new InMemoryChristmasTreeRepository();
        $this->service = new ChristmasTreeIdentityService($this->repository);
    }

    public function testCreatesAndPersistsAValidUnicodeOwner(): void
    {
        $creation = $this->service->create('  Maria   José  ');
        $persisted = $this->service->findPublic($creation->tree->publicId);

        self::assertSame('Maria José', $creation->tree->ownerName);
        self::assertSame('classic', $creation->tree->theme);
        self::assertSame(12, strlen($creation->tree->publicId));
        self::assertSame($creation->tree->publicId, $persisted?->publicId);
    }

    public function testRejectsAnInvalidName(): void
    {
        $this->expectException(TreeValidationException::class);
        $this->service->create(' ');
    }

    public function testRejectsANameLongerThanSixtyCharacters(): void
    {
        $this->expectException(TreeValidationException::class);
        $this->service->create(str_repeat('á', 61));
    }

    public function testRepeatedNamesReceiveDifferentPublicIds(): void
    {
        $first = $this->service->create('Maria');
        $second = $this->service->create('Maria');

        self::assertNotSame($first->tree->publicId, $second->tree->publicId);
        self::assertSame('Maria', $second->tree->ownerName);
    }

    public function testAdministrativeAccessRequiresTheSecretToken(): void
    {
        $creation = $this->service->create('João');

        self::assertTrue($this->service->ownerIsAuthorized($creation->tree->publicId, $creation->adminToken));
        self::assertFalse($this->service->ownerIsAuthorized($creation->tree->publicId, 'invalid-token'));
        self::assertFalse($this->service->ownerIsAuthorized('invalid-id', $creation->adminToken));
    }

    public function testValidRecoveryRotatesBothCredentials(): void
    {
        $creation = $this->service->create('Ana');
        $recovery = $this->service->recover($creation->tree->publicId, $creation->recoveryCode);

        self::assertNotNull($recovery);
        self::assertNotSame($creation->adminToken, $recovery->adminToken);
        self::assertNotSame($creation->recoveryCode, $recovery->recoveryCode);
        self::assertFalse($this->service->ownerIsAuthorized($creation->tree->publicId, $creation->adminToken));
        self::assertTrue($this->service->ownerIsAuthorized($creation->tree->publicId, $recovery->adminToken));
        self::assertNull($this->service->recover($creation->tree->publicId, $creation->recoveryCode));
    }

    public function testInvalidRecoveryDoesNotGrantAccess(): void
    {
        $creation = $this->service->create('Luiza');

        self::assertNull($this->service->recover($creation->tree->publicId, str_repeat('x', 43)));
    }

    public function testPublicRepresentationNeverContainsCredentials(): void
    {
        $public = $this->service->create('Carlos')->tree->toPublicArray();

        self::assertArrayNotHasKey('admin_token', $public);
        self::assertArrayNotHasKey('admin_token_hash', $public);
        self::assertArrayNotHasKey('recovery_code', $public);
        self::assertArrayNotHasKey('recovery_token_hash', $public);
    }
}

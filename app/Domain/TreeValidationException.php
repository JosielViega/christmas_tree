<?php

declare(strict_types=1);

namespace App\Domain;

use InvalidArgumentException;

final class TreeValidationException extends InvalidArgumentException
{
    /** @param array<string, list<string>> $errors */
    public function __construct(public readonly array $errors)
    {
        parent::__construct('The tree data is invalid.');
    }
}

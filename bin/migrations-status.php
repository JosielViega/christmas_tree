<?php

declare(strict_types=1);

use App\Core\Database;
use Dotenv\Dotenv;

$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
Dotenv::createImmutable($root)->safeLoad();

try {
    $pdo = (new Database(require $root . '/config/database.php'))->connection();
    $files = glob($root . '/database/migrations/*.sql') ?: [];
    sort($files, SORT_STRING);
    $tableExists = $pdo->query("SHOW TABLES LIKE 'migrations'")->fetchColumn() !== false;
    $executed = $tableExists
        ? $pdo->query('SELECT migration FROM migrations')->fetchAll(PDO::FETCH_COLUMN)
        : [];
    $pending = array_values(array_filter(
        array_map('basename', $files),
        static fn (string $migration): bool => !in_array($migration, $executed, true),
    ));

    fwrite(STDOUT, 'Database reachable: yes' . PHP_EOL);
    fwrite(STDOUT, 'Recorded migrations: ' . count($executed) . PHP_EOL);
    fwrite(STDOUT, 'Pending migrations: ' . count($pending) . PHP_EOL);
    foreach ($pending as $migration) {
        fwrite(STDOUT, '  - ' . $migration . PHP_EOL);
    }
    exit($pending === [] ? 0 : 2);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Migration status failed: ' . get_class($exception) . PHP_EOL);
    exit(1);
}

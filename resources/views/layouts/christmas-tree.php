<?php

declare(strict_types=1);

/** @var string $content */
/** @var string $title */
/** @var array{script: string, styles: list<string>} $frontend */
?>
<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#050505">
    <meta name="description" content="Árvore de Natal 3D interativa">
    <title><?= e($title) ?></title>
    <link rel="icon" type="image/svg+xml" href="/assets/app/favicon.svg">
<?php foreach ($frontend['styles'] as $stylesheet): ?>
    <link rel="stylesheet" href="<?= e($stylesheet) ?>">
<?php endforeach; ?>
    <script type="module" src="<?= e($frontend['script']) ?>" defer></script>
</head>
<body>
<?= $content ?>
</body>
</html>

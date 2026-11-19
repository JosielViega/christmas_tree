<?php

declare(strict_types=1);

/** @var string $content */
/** @var string $title */
/** @var array{script: string, styles: list<string>} $frontend */
/** @var string $frontendBootstrap */
$meta = is_array($meta ?? null) ? $meta : [];
$metaTitle = (string) ($meta['title'] ?? $title);
$metaDescription = (string) ($meta['description'] ?? 'Árvore de Natal 3D interativa');
$canonicalUrl = (string) ($meta['canonical_url'] ?? '');
$imageUrl = (string) ($meta['image_url'] ?? '');
?>
<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#050505">
    <meta name="description" content="<?= e($metaDescription) ?>">
    <title><?= e($title) ?></title>
<?php if ($canonicalUrl !== ''): ?>
    <link rel="canonical" href="<?= e($canonicalUrl) ?>">
<?php endif; ?>
    <meta property="og:type" content="website">
    <meta property="og:locale" content="pt_BR">
    <meta property="og:title" content="<?= e($metaTitle) ?>">
    <meta property="og:description" content="<?= e($metaDescription) ?>">
<?php if ($canonicalUrl !== ''): ?>
    <meta property="og:url" content="<?= e($canonicalUrl) ?>">
<?php endif; ?>
<?php if ($imageUrl !== ''): ?>
    <meta property="og:image" content="<?= e($imageUrl) ?>">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Árvore de Natal iluminada em uma noite com neve">
<?php endif; ?>
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?= e($metaTitle) ?>">
    <meta name="twitter:description" content="<?= e($metaDescription) ?>">
<?php if ($imageUrl !== ''): ?>
    <meta name="twitter:image" content="<?= e($imageUrl) ?>">
<?php endif; ?>
    <link rel="icon" type="image/svg+xml" href="/assets/app/favicon.svg">
<?php foreach ($frontend['styles'] as $stylesheet): ?>
    <link rel="stylesheet" href="<?= e($stylesheet) ?>">
<?php endforeach; ?>
    <script>window.__CHRISTMAS_TREE_BOOTSTRAP__ = <?= $frontendBootstrap ?>;</script>
    <script type="module" src="<?= e($frontend['script']) ?>" defer></script>
</head>
<body>
<?= $content ?>
</body>
</html>

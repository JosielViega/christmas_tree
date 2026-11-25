<?php

declare(strict_types=1);

return [
    // Production application source is copied only from this allowlist.
    'include' => [
        'app',
        'bin/cleanup-gift-drafts.php',
        'bin/lib/ProcessLock.php',
        'bin/migrate.php',
        'bin/migrations-status.php',
        'bootstrap',
        'config',
        'database/migrations',
        'public/assets',
        'public/.htaccess',
        'public/index.php',
        'resources',
        'routes',
        'storage/private/.gitkeep',
        'composer.json',
        'composer.lock',
    ],

    // These paths document intentional omissions even though the allowlist is primary.
    'ignore' => [
        '.git',
        '.github',
        '.phpunit.cache',
        'deploy',
        'docs',
        'frontend',
        'tests',
        'phpunit.xml',
        'public/uploads',
        'storage/cache',
        'storage/logs',
        'storage/private/gift-textures',
        'vendor',
        'node_modules',
    ],

    // A build fails if one of these names or extensions reaches the generated mirror.
    'protected_names' => [
        '.env',
        '.env.example',
        '.htaccess',
        '.user.ini',
        'php.ini',
        'error_log',
    ],
    'allowed_server_files' => [
        'public/.htaccess',
    ],
    'protected_extensions' => [
        'log',
        'pem',
        'key',
        'crt',
        'p12',
        'pfx',
    ],
    'protected_directories' => [
        '.git',
        '.github',
        '.phpunit.cache',
        '.well-known',
        'backups',
        'cache',
        'cgi-bin',
        'logs',
        'ssl',
        'tests',
        'tmp',
        'uploads',
    ],
    'sensitive_name_patterns' => [
        '/(?:^|\/)(?:secret|secrets)(?:\.|\/|$)/i',
        '/(?:^|\/)(?:credential|credentials)(?:\.|\/|$)/i',
        '/private[-_]?key/i',
    ],
    'secret_content_patterns' => [
        '/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/',
        '/\b(?:APP_USR|TEST)-[A-Za-z0-9_-]{20,}\b/',
        '/\bMERCADOPAGO_(?:ACCESS_TOKEN|WEBHOOK_SECRET)[ \t]*=[ \t]*[^\s#]{12,}/i',
        '/\bDB_PASSWORD[ \t]*=[ \t]*[^\s#]{8,}/i',
    ],
];

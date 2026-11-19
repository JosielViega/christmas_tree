<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

final class HelpersTest extends TestCase
{
    public function testEscapesHtmlByDefault(): void
    {
        self::assertSame('&lt;script&gt;&quot;x&quot;&lt;/script&gt;', e('<script>"x"</script>'));
    }

    public function testBuildsPublicTreeUrlWithoutCredentialsQueryOrFragment(): void
    {
        self::assertSame(
            'https://christmas.test/app/t/AbCdEf1234_-',
            public_tree_url('https://admin:private@christmas.test/app?debug=1#token', 'AbCdEf1234_-'),
        );
    }
}

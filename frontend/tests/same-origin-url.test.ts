import assert from 'node:assert/strict';
import test from 'node:test';
import { sameOriginTreeUrl } from '../utils/sameOriginUrl.ts';

test('shared tree links preserve the browser origin', () => {
  assert.equal(sameOriginTreeUrl('/t/abc_123', 'http://127.0.0.1:8010'), 'http://127.0.0.1:8010/t/abc_123');
  assert.equal(sameOriginTreeUrl('/t/abc_123', 'http://localhost:8010/'), 'http://localhost:8010/t/abc_123');
});

test('shared links reject paths outside public trees', () => {
  assert.throws(() => sameOriginTreeUrl('https://attacker.test/t/abc', 'https://christmas.test'));
  assert.throws(() => sameOriginTreeUrl('/api/trees/abc', 'https://christmas.test'));
});

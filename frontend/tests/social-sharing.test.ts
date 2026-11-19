import assert from 'node:assert/strict';
import test from 'node:test';
import { STORY_HEIGHT, STORY_WIDTH, buildPublicTreeUrl, canShareFiles, downloadBlob, fitContain, getTreeCanvas, storyFilename } from '../utils/socialSharing.ts';

test('story card uses an exact 9:16 canvas', () => {
  assert.equal(STORY_WIDTH, 1080);
  assert.equal(STORY_HEIGHT, 1920);
  assert.equal(STORY_WIDTH / STORY_HEIGHT, 9 / 16);
});

test('public tree link drops credentials, query and fragment', () => {
  assert.equal(
    buildPublicTreeUrl('AbCdEf1234_-', 'https://admin:private@christmas.test/path?token=secret#code'),
    'https://christmas.test/t/AbCdEf1234_-',
  );
});

test('tree capture is fitted without distortion', () => {
  assert.deepEqual(fitContain(1600, 900, 900, 1000), { width: 900, height: 506.25 });
  assert.deepEqual(fitContain(900, 1600, 900, 1000), { width: 562.5, height: 1000 });
  assert.throws(() => fitContain(0, 900, 900, 1000));
});

test('file sharing reports unsupported browsers without invoking APIs', () => {
  assert.equal(canShareFiles([], {} as Navigator), false);
  const supported = {
    share: async () => undefined,
    canShare: () => true,
  } as unknown as Navigator;
  assert.equal(canShareFiles([], supported), true);
});

test('download filename is local and filesystem safe', () => {
  assert.equal(storyFilename('João & Família'), 'story-arvore-joao-familia.png');
});

test('image download clicks a local link and releases the object URL', () => {
  let clicked = false;
  let revoked = '';
  const link = { href: '', download: '', click: () => { clicked = true; } };
  downloadBlob(new Blob(['image'], { type: 'image/png' }), 'story.png', {
    createObjectUrl: () => 'blob:story-card',
    revokeObjectUrl: (url) => { revoked = url; },
    createLink: () => link,
    defer: (callback) => callback(),
  });
  assert.equal(clicked, true);
  assert.equal(link.download, 'story.png');
  assert.equal(revoked, 'blob:story-card');
});

test('missing 3D canvas produces an explicit capture failure', () => {
  assert.throws(
    () => getTreeCanvas({ querySelector: () => null } as unknown as Document),
    /capturar a árvore 3D/,
  );
});

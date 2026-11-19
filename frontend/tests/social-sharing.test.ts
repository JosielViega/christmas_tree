import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STORY_HEIGHT,
  STORY_SCENE_HEIGHT,
  STORY_SCENE_WIDTH,
  STORY_WIDTH,
  buildPublicTreeUrl,
  buildStoryCardCopy,
  canShareFiles,
  downloadBlob,
  fitContain,
  getTreeCanvas,
  storyFilename,
  withTemporaryCaptureState,
} from '../utils/socialSharing.ts';

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

test('vertical scene capture is tall and fills the story image area without distortion', () => {
  assert.equal(STORY_SCENE_WIDTH, 900);
  assert.equal(STORY_SCENE_HEIGHT, 1100);
  const fitted = fitContain(STORY_SCENE_WIDTH, STORY_SCENE_HEIGHT, 980, 1110);
  assert.equal(fitted.height, 1110);
  assert.ok(Math.abs((fitted.width / fitted.height) - (STORY_SCENE_WIDTH / STORY_SCENE_HEIGHT)) < Number.EPSILON);
  assert.ok(fitted.width > 900);
});

test('temporary capture restores camera-like state after success', async () => {
  const state = { cameraZ: 32, aspect: 16 / 9, controlsEnabled: true, width: 1440, height: 900, dpr: 2 };
  const result = await withTemporaryCaptureState(
    () => ({ ...state }),
    () => { Object.assign(state, { cameraZ: 23.5, aspect: 9 / 16, controlsEnabled: false, width: 720, height: 1280, dpr: 1 }); },
    async () => 'captured',
    (snapshot) => { Object.assign(state, snapshot); },
  );
  assert.equal(result, 'captured');
  assert.deepEqual(state, { cameraZ: 32, aspect: 16 / 9, controlsEnabled: true, width: 1440, height: 900, dpr: 2 });
});

test('temporary capture restores camera-like state when capture fails', async () => {
  const state = { cameraZ: 32, controlsEnabled: true, width: 1440, height: 900, dpr: 2 };
  await assert.rejects(withTemporaryCaptureState(
    () => ({ ...state }),
    () => { Object.assign(state, { cameraZ: 23.5, controlsEnabled: false, width: 720, height: 1280, dpr: 1 }); },
    async () => { throw new Error('capture failed'); },
    (snapshot) => { Object.assign(state, snapshot); },
  ), /capture failed/);
  assert.deepEqual(state, { cameraZ: 32, controlsEnabled: true, width: 1440, height: 900, dpr: 2 });
});

test('story copy contains only public presentation fields', () => {
  const copy = JSON.stringify(buildStoryCardCopy('Família Silva', 12));
  assert.doesNotMatch(copy, /recovery|password|credential|código de recuperação/i);
  assert.doesNotMatch(copy, /conteúdo da mensagem|mensagem privada/i);
  assert.match(copy, /12 amigos já decoraram/);
  assert.match(copy, /Acesse pelo link do Story/);
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

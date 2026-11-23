import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ProgressiveTextureCache, TaskQueue } from '../utils/progressiveTextures.ts';

type FakeTexture = { name: string; disposed: boolean; dispose: () => void };
type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: Error) => void };

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const texture = (name: string): FakeTexture => {
  const value: FakeTexture = { name, disposed: false, dispose: () => { value.disposed = true; } };
  return value;
};

const controlledCache = () => {
  const loads = new Map<string, Array<Deferred<FakeTexture>>>();
  const events: Array<{ event: string; id: number; reason?: string }> = [];
  const cache = new ProgressiveTextureCache<FakeTexture>(
    (key) => {
      const task = deferred<FakeTexture>();
      loads.set(key, [...(loads.get(key) ?? []), task]);
      return task.promise;
    },
    (event, id, reason) => events.push({ event, id, reason }),
  );
  return { cache, loads, events };
};

test('one, three and six photographs are all processed and released', async () => {
  for (const count of [1, 3, 6]) {
    const loaded: FakeTexture[] = [];
    const cache = new ProgressiveTextureCache<FakeTexture>(async (key) => {
      const value = texture(key);
      loaded.push(value);
      return value;
    });
    const resources = Array.from({ length: count }, (_, index) => cache.acquire(`photo-${index}`));
    assert.equal((await Promise.all(resources.map((resource) => resource.promise))).length, count);
    resources.forEach((resource) => resource.release());
    assert.equal(loaded.filter((value) => value.disposed).length, count);
  }
});

test('the decode queue preserves a maximum of two simultaneous photographs', async () => {
  const queue = new TaskQueue(2);
  let active = 0;
  let maximum = 0;
  const gates = Array.from({ length: 6 }, () => deferred<void>());
  const jobs = gates.map((gate) => queue.run(async () => {
    active++;
    maximum = Math.max(maximum, active);
    await gate.promise;
    active--;
  }));
  assert.equal(maximum, 2);
  for (const gate of gates) {
    gate.resolve();
    await Promise.resolve();
  }
  await Promise.all(jobs);
  assert.equal(maximum, 2);
});

test('photographs may complete out of order without replacing each other', async () => {
  const { cache, loads } = controlledCache();
  const first = cache.acquire('first');
  const second = cache.acquire('second');
  const third = cache.acquire('third');
  loads.get('third')![0].resolve(texture('third'));
  loads.get('first')![0].resolve(texture('first'));
  loads.get('second')![0].resolve(texture('second'));
  assert.deepEqual((await Promise.all([first.promise, second.promise, third.promise])).map((value) => value.name), ['first', 'second', 'third']);
  first.release(); second.release(); third.release();
});

for (const failedIndex of [0, 1]) {
  test(`failure of photograph ${failedIndex + 1} stays isolated`, async () => {
    const { cache, loads } = controlledCache();
    const resources = ['first', 'second', 'third'].map((key) => cache.acquire(key));
    loads.get(['first', 'second'][failedIndex])![0].reject(new Error('decode failed'));
    for (const key of ['first', 'second', 'third'].filter((_, index) => index !== failedIndex)) {
      loads.get(key)![0].resolve(texture(key));
    }
    const results = await Promise.allSettled(resources.map((resource) => resource.promise));
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 2);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    resources.forEach((resource) => resource.release());
  });
}

test('unmount and immediate remount share the pending entry without premature disposal', async () => {
  const { cache, loads } = controlledCache();
  const firstMount = cache.acquire('same');
  firstMount.release();
  const secondMount = cache.acquire('same');
  assert.equal(secondMount.id, firstMount.id);
  assert.equal(loads.get('same')!.length, 1);
  const loaded = texture('same');
  loads.get('same')![0].resolve(loaded);
  assert.equal(await secondMount.promise, loaded);
  assert.equal(loaded.disposed, false);
  secondMount.release();
  assert.equal(loaded.disposed, true);
});

test('a rejected old entry cannot delete an immediate replacement for the same URL', async () => {
  const { cache, loads } = controlledCache();
  const first = cache.acquire('same');
  first.release();
  let replacement: ReturnType<typeof cache.acquire> | undefined;
  const remount = first.promise.catch(() => { replacement = cache.acquire('same'); });
  loads.get('same')![0].reject(new Error('old request failed'));
  await remount;
  assert.ok(replacement);
  assert.notEqual(replacement.id, first.id);
  assert.equal(loads.get('same')!.length, 2);
  const fresh = texture('fresh');
  loads.get('same')![1].resolve(fresh);
  assert.equal(await replacement.promise, fresh);
  assert.equal(fresh.disposed, false);
  replacement.release();
  assert.equal(fresh.disposed, true);
});

test('changing the photograph releases only the old URL', async () => {
  const { cache, loads } = controlledCache();
  const oldResource = cache.acquire('old');
  const newResource = cache.acquire('new');
  const oldTexture = texture('old');
  const newTexture = texture('new');
  loads.get('old')![0].resolve(oldTexture);
  loads.get('new')![0].resolve(newTexture);
  await Promise.all([oldResource.promise, newResource.promise]);
  oldResource.release();
  assert.equal(oldTexture.disposed, true);
  assert.equal(newTexture.disposed, false);
  newResource.release();
});

test('shared references dispose a texture only after the final release', async () => {
  const { cache, loads } = controlledCache();
  const first = cache.acquire('shared');
  const second = cache.acquire('shared');
  const shared = texture('shared');
  loads.get('shared')![0].resolve(shared);
  await Promise.all([first.promise, second.promise]);
  first.release();
  assert.equal(shared.disposed, false);
  second.release();
  assert.equal(shared.disposed, true);
});

test('diagnostics use anonymous resource ids and cover creation, application and disposal', async () => {
  const { cache, loads, events } = controlledCache();
  const resource = cache.acquire('/private/tree/photo.jpg?secret=hidden');
  const loaded = texture('diagnostic');
  loads.get('/private/tree/photo.jpg?secret=hidden')![0].resolve(loaded);
  await resource.promise;
  cache.reportApplied(resource.id);
  resource.release();
  assert.deepEqual(events.map(({ event }) => event), ['queued', 'created', 'applied', 'disposed']);
  assert.equal(JSON.stringify(events).includes('private/tree'), false);
  assert.equal(JSON.stringify(events).includes('secret'), false);
});

test('Polaroid keeps separated front and back surfaces while rotating', () => {
  const source = readFileSync(new URL('../components/Polaroid.tsx', import.meta.url), 'utf8');
  assert.match(source, /position=\{\[0, -0\.65, 0\.025\]\}/);
  assert.match(source, /position=\{\[0, -0\.75, -0\.021\]\}/);
  assert.match(source, /side=\{THREE\.BackSide\}/);
  assert.doesNotMatch(source, /depthTest=\{false\}/);
});

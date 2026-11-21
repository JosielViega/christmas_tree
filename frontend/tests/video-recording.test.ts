import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STORY_VIDEO_DURATION_MS,
  VideoRecordingCancelledError,
  VideoRecordingError,
  buildStoryVideoCopy,
  chooseStoryVideoProfile,
  drawStoryVideoFrame,
  fitStoryVideoFrame,
  isVideoRecordingSupported,
  recordCanvasVideo,
  selectVideoMimeType,
  shareStoryVideo,
  storyVideoFilename,
  type MediaRecorderConstructor,
  type RecordingEnvironment,
} from '../utils/videoRecording.ts';

class FakeMediaRecorder {
  static isTypeSupported = (mimeType: string) => mimeType === 'video/webm;codecs=vp8';
  state: RecordingState = 'inactive';
  mimeType: string;
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? 'video/webm';
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['frame'], { type: this.mimeType }) } as BlobEvent);
    this.onstop?.();
  }
}

const recordingFixture = (constructor: MediaRecorderConstructor = FakeMediaRecorder as unknown as MediaRecorderConstructor) => {
  let stoppedTracks = 0;
  const stream = {
    getTracks: () => [{ stop: () => { stoppedTracks += 1; } }],
  } as unknown as MediaStream;
  const canvas = {
    captureStream: () => stream,
  } as unknown as HTMLCanvasElement;
  const environment: RecordingEnvironment = {
    MediaRecorder: constructor,
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    now: () => performance.now(),
  };
  return { canvas, environment, stoppedTracks: () => stoppedTracks };
};

test('video support requires MediaRecorder and captureStream', () => {
  const fixture = recordingFixture();
  assert.equal(isVideoRecordingSupported(fixture.canvas, fixture.environment.MediaRecorder), true);
  assert.equal(isVideoRecordingSupported(fixture.canvas, null), false);
  assert.equal(isVideoRecordingSupported({ captureStream: undefined } as unknown as HTMLCanvasElement, fixture.environment.MediaRecorder), false);
});

test('recording rejects unsupported environments without requesting a stream', async () => {
  let requested = false;
  const canvas = { captureStream: () => { requested = true; throw new Error('must not run'); } } as unknown as HTMLCanvasElement;
  await assert.rejects(recordCanvasVideo({
    canvas,
    environment: { ...recordingFixture().environment, MediaRecorder: null },
  }), (error: unknown) => error instanceof VideoRecordingError && error.code === 'unsupported');
  assert.equal(requested, false);
});

test('format selection uses only a MIME type reported by the browser', () => {
  assert.equal(selectVideoMimeType(FakeMediaRecorder as unknown as MediaRecorderConstructor), 'video/webm;codecs=vp8');
  assert.equal(selectVideoMimeType({ isTypeSupported: () => false } as unknown as MediaRecorderConstructor), '');
  assert.equal(selectVideoMimeType({ isTypeSupported: () => { throw new Error('broken probe'); } } as unknown as MediaRecorderConstructor), '');
  assert.equal(selectVideoMimeType(null), '');
});

test('normal recording returns data and releases every stream track', async () => {
  const fixture = recordingFixture();
  const result = await recordCanvasVideo({ canvas: fixture.canvas, durationMs: 5, environment: fixture.environment });
  assert.ok(result.blob.size > 0);
  assert.equal(result.extension, 'webm');
  assert.equal(fixture.stoppedTracks(), 1);
});

test('cancelling recording rejects cleanly and releases tracks', async () => {
  const fixture = recordingFixture();
  const controller = new AbortController();
  const recording = recordCanvasVideo({ canvas: fixture.canvas, durationMs: 1_000, signal: controller.signal, environment: fixture.environment });
  controller.abort();
  await assert.rejects(recording, VideoRecordingCancelledError);
  assert.equal(fixture.stoppedTracks(), 1);
});

test('recorder initialization failure is sanitized and releases tracks', async () => {
  class BrokenRecorder {
    static isTypeSupported = () => true;
    constructor() { throw new Error('internal codec detail'); }
  }
  const fixture = recordingFixture(BrokenRecorder as unknown as MediaRecorderConstructor);
  await assert.rejects(
    recordCanvasVideo({ canvas: fixture.canvas, durationMs: 5, environment: fixture.environment }),
    (error: unknown) => error instanceof VideoRecordingError && error.code === 'initialization' && !error.message.includes('codec detail'),
  );
  assert.equal(fixture.stoppedTracks(), 1);
});

test('MediaRecorder errors do not leave stream tracks active', async () => {
  class ErrorRecorder extends FakeMediaRecorder {
    start() {
      this.state = 'recording';
      setTimeout(() => this.onerror?.(new Event('error')), 0);
    }
  }
  const fixture = recordingFixture(ErrorRecorder as unknown as MediaRecorderConstructor);
  await assert.rejects(recordCanvasVideo({ canvas: fixture.canvas, durationMs: 100, environment: fixture.environment }), VideoRecordingError);
  assert.equal(fixture.stoppedTracks(), 1);
});

test('empty recordings fail explicitly and release tracks', async () => {
  class EmptyRecorder extends FakeMediaRecorder {
    stop() {
      this.state = 'inactive';
      this.onstop?.();
    }
  }
  const fixture = recordingFixture(EmptyRecorder as unknown as MediaRecorderConstructor);
  await assert.rejects(
    recordCanvasVideo({ canvas: fixture.canvas, durationMs: 5, environment: fixture.environment }),
    (error: unknown) => error instanceof VideoRecordingError && error.code === 'empty',
  );
  assert.equal(fixture.stoppedTracks(), 1);
});

test('captureStream initialization errors are sanitized', async () => {
  const canvas = { captureStream: () => { throw new Error('driver internals'); } } as unknown as HTMLCanvasElement;
  await assert.rejects(
    recordCanvasVideo({ canvas, environment: recordingFixture().environment }),
    (error: unknown) => error instanceof VideoRecordingError && error.code === 'initialization' && !error.message.includes('driver'),
  );
});

test('duration, adaptive profile and filename remain bounded', () => {
  assert.equal(STORY_VIDEO_DURATION_MS, 8_000);
  assert.deepEqual(chooseStoryVideoProfile({ deviceMemory: 2, hardwareConcurrency: 2 }), { width: 720, height: 1280, fps: 24, videoBitsPerSecond: 4_000_000 });
  assert.deepEqual(chooseStoryVideoProfile({ deviceMemory: 8, hardwareConcurrency: 8 }), { width: 1080, height: 1920, fps: 30, videoBitsPerSecond: 8_000_000 });
  assert.equal(storyVideoFilename('João & Família', 'video/mp4'), 'video-arvore-joao-familia.mp4');
  assert.equal(storyVideoFilename('', 'video/webm'), 'video-arvore-natal.webm');
});

test('video frame fitting preserves one uniform scale on exact and mismatched sources', () => {
  const exact = fitStoryVideoFrame(720, 1280, 1080, 1920);
  assert.deepEqual(exact, { x: 0, y: 0, width: 1080, height: 1920, scale: 1.5 });

  const landscape = fitStoryVideoFrame(1600, 900, 720, 1280);
  assert.equal(landscape.width / 1600, landscape.scale);
  assert.equal(landscape.height / 900, landscape.scale);
  assert.equal(landscape.x, 0);
  assert.ok(landscape.y > 0, 'mismatched frames are centered instead of stretched');
  assert.throws(() => fitStoryVideoFrame(0, 1280, 720, 1280), VideoRecordingError);
});

test('canvas composition draws the scene with the proportional placement', () => {
  const drawCalls: unknown[][] = [];
  const gradient = { addColorStop: () => undefined };
  const context = {
    clearRect: () => undefined,
    fillRect: () => undefined,
    drawImage: (...args: unknown[]) => drawCalls.push(args),
    createLinearGradient: () => gradient,
    fillText: () => undefined,
  } as unknown as CanvasRenderingContext2D;
  const output = { width: 720, height: 1280, getContext: () => context } as unknown as HTMLCanvasElement;
  const source = { width: 1600, height: 900 } as HTMLCanvasElement;

  drawStoryVideoFrame(output, source, 'Família', 2, 7_500);

  assert.deepEqual(drawCalls[0], [source, 0, 437.5, 720, 405]);
});

test('video composition copy contains no private or recovery data', () => {
  const copy = JSON.stringify(buildStoryVideoCopy('Família Silva', 7));
  assert.match(copy, /7 amigos já decoraram/);
  assert.doesNotMatch(copy, /recovery|password|credential|código de recuperação|conteúdo da mensagem/i);
});

test('video sharing falls back without invoking unsupported APIs', async () => {
  assert.equal(await shareStoryVideo(new Blob(['video'], { type: 'video/webm' }), 'Família', {} as Navigator), false);
});

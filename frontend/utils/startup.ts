export type StartupPhase = 'initializing' | 'loading_data' | 'preparing_scene' | 'first_frame' | 'ready' | 'error';

export const STARTUP_TIMEOUT_MS = 20_000;

export const startupMessage = (phase: StartupPhase): string => ({
  initializing: 'Preparando sua árvore...',
  loading_data: 'Organizando os enfeites...',
  preparing_scene: 'Acendendo as luzes...',
  first_frame: 'Acendendo as luzes...',
  ready: 'Tudo pronto!',
  error: 'Não foi possível carregar sua árvore.',
})[phase];

const order: StartupPhase[] = ['initializing', 'loading_data', 'preparing_scene', 'first_frame', 'ready'];

export const canAdvanceStartup = (from: StartupPhase, to: StartupPhase): boolean => {
  if (to === 'error') return from !== 'ready';
  if (from === 'error') return to === 'initializing';
  return order.indexOf(to) >= order.indexOf(from);
};

export const isStartupBlocking = (phase: StartupPhase): boolean => phase !== 'ready';

type StartupMetric =
  | 'app_start'
  | 'react_initialized'
  | 'tree_data_start'
  | 'tree_data_ready'
  | 'ornaments_start'
  | 'ornaments_ready'
  | 'memories_start'
  | 'memories_ready'
  | 'gifts_start'
  | 'gifts_ready'
  | 'geometry_start'
  | 'geometry_ready'
  | 'materials_ready'
  | 'memory_textures_start'
  | 'memory_textures_ready'
  | 'webgl_ready'
  | 'scene_prepared'
  | 'first_frame'
  | 'interactive';

const prefix = 'christmas-tree:';

export const markStartup = (metric: StartupMetric): void => {
  if (!import.meta.env.DEV || typeof performance === 'undefined') return;
  performance.mark(`${prefix}${metric}`);
};

export const measureStartup = (name: string, start: StartupMetric, end: StartupMetric): void => {
  if (!import.meta.env.DEV || typeof performance === 'undefined') return;
  try { performance.measure(`${prefix}${name}`, `${prefix}${start}`, `${prefix}${end}`); } catch { /* a missing optional mark is harmless */ }
};

export const getInitialDpr = (capabilities: { hardwareConcurrency?: number; deviceMemory?: number; devicePixelRatio?: number }): [number, number] => {
  const modest = (capabilities.hardwareConcurrency ?? 8) <= 4 || (capabilities.deviceMemory ?? 8) <= 4;
  return [1, modest ? 1.25 : Math.min(1.75, capabilities.devicePixelRatio ?? 1.75)];
};

export const getInitialTreeParticleCount = (capabilities: { hardwareConcurrency?: number; deviceMemory?: number }, fullCount: number): number => {
  const modest = (capabilities.hardwareConcurrency ?? 8) <= 4 || (capabilities.deviceMemory ?? 8) <= 4;
  return modest ? Math.round(fullCount * 0.6) : fullCount;
};

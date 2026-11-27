import type { PerformanceQuality } from './performance';

export type GraphicsQualityPreference = 'auto' | PerformanceQuality;

export const GRAPHICS_QUALITY_STORAGE_KEY = 'christmas-tree:graphics-quality';

export const GRAPHICS_QUALITY_OPTIONS: ReadonlyArray<{
  value: GraphicsQualityPreference;
  label: string;
  description: string;
}> = [
  { value: 'auto', label: 'Automática', description: 'Escolhe uma vez ao abrir a árvore.' },
  { value: 'high', label: 'Alta', description: 'Mais detalhes; pode reduzir a fluidez.' },
  { value: 'balanced', label: 'Equilibrada', description: 'Boa nitidez e desempenho.' },
  { value: 'economy', label: 'Econômica', description: 'Prioriza fluidez e bateria.' },
];

interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const browserStorage = (): PreferenceStorage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const parseGraphicsQualityPreference = (value: unknown): GraphicsQualityPreference => (
  value === 'high' || value === 'balanced' || value === 'economy' || value === 'auto' ? value : 'auto'
);

export const loadGraphicsQualityPreference = (
  storage: PreferenceStorage | null = browserStorage(),
): GraphicsQualityPreference => {
  try {
    return parseGraphicsQualityPreference(storage?.getItem(GRAPHICS_QUALITY_STORAGE_KEY));
  } catch {
    return 'auto';
  }
};

export const saveGraphicsQualityPreference = (
  preference: GraphicsQualityPreference,
  storage: PreferenceStorage | null = browserStorage(),
): boolean => {
  try {
    if (!storage) return false;
    storage.setItem(GRAPHICS_QUALITY_STORAGE_KEY, preference);
    return true;
  } catch {
    return false;
  }
};

export const resolveGraphicsQuality = (
  preference: GraphicsQualityPreference,
  automaticQuality: PerformanceQuality,
): PerformanceQuality => preference === 'auto' ? automaticQuality : preference;

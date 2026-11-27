import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  GRAPHICS_QUALITY_STORAGE_KEY,
  loadGraphicsQualityPreference,
  parseGraphicsQualityPreference,
  resolveGraphicsQuality,
  saveGraphicsQualityPreference,
} from '../utils/graphicsQuality.ts';

test('quality preference accepts only the four public modes', () => {
  for (const mode of ['auto', 'high', 'balanced', 'economy'] as const) {
    assert.equal(parseGraphicsQualityPreference(mode), mode);
  }
  assert.equal(parseGraphicsQualityPreference('ultra'), 'auto');
  assert.equal(parseGraphicsQualityPreference(null), 'auto');
});

test('manual quality overrides automatic selection and automatic remains session-stable', () => {
  assert.equal(resolveGraphicsQuality('auto', 'balanced'), 'balanced');
  assert.equal(resolveGraphicsQuality('high', 'economy'), 'high');
  assert.equal(resolveGraphicsQuality('balanced', 'high'), 'balanced');
  assert.equal(resolveGraphicsQuality('economy', 'high'), 'economy');
});

test('preference persists only its validated local value and tolerates unavailable storage', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  assert.equal(saveGraphicsQualityPreference('balanced', storage), true);
  assert.deepEqual([...values.entries()], [[GRAPHICS_QUALITY_STORAGE_KEY, 'balanced']]);
  assert.equal(loadGraphicsQualityPreference(storage), 'balanced');

  const unavailable = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(loadGraphicsQualityPreference(unavailable), 'auto');
  assert.equal(saveGraphicsQualityPreference('high', unavailable), false);
});

test('options expose accessible mobile quality controls wired to App and Scene', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const overlay = readFileSync(new URL('../components/Overlay.tsx', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('../components/Scene.tsx', import.meta.url), 'utf8');
  assert.match(app, /loadGraphicsQualityPreference\(\)/);
  assert.match(app, /saveGraphicsQualityPreference\(preference\)/);
  assert.match(app, /qualityPreference=\{graphicsQuality\}/);
  assert.match(overlay, /Qualidade gráfica/);
  assert.match(overlay, /role="menuitemradio"/);
  assert.match(overlay, /pode reduzir a fluidez/);
  assert.doesNotMatch(scene, /PerformanceMonitor/);
});

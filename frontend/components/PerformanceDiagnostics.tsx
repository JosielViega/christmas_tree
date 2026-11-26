import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { PerformanceQuality } from '../utils/performance';
import { summarizeFrameTimes } from '../utils/performance';

export interface PerformanceMetrics {
  averageFps: number;
  minimumFps: number;
  averageFrameMs: number;
  p95FrameMs: number;
  p99FrameMs: number;
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
  dpr: number;
  width: number;
  height: number;
  timeToInteractiveMs: number | null;
  deviceMemoryGb: number | null;
  jsHeapMb: number | null;
  contextLosses: number;
}

export interface DiagnosticSettings {
  quality: 'auto' | PerformanceQuality;
  effects: boolean;
  dynamicLights: boolean;
  automaticOrnaments: boolean;
  giftsAndPhotos: boolean;
  animations: boolean;
  reducedDpr: boolean;
}

export const DEFAULT_DIAGNOSTIC_SETTINGS: DiagnosticSettings = {
  quality: 'auto',
  effects: true,
  dynamicLights: true,
  automaticOrnaments: true,
  giftsAndPhotos: true,
  animations: true,
  reducedDpr: false,
};

export const PerformanceProbe: React.FC<{
  enabled: boolean;
  onMetrics: (metrics: PerformanceMetrics) => void;
}> = ({ enabled, onMetrics }) => {
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  const samples = useRef<number[]>([]);
  const lastReport = useRef(0);
  const contextLosses = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const canvas = gl.domElement;
    const lost = () => { contextLosses.current += 1; };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [enabled, gl]);

  useFrame((state, delta) => {
    if (!enabled) return;
    const frameMs = Math.min(1_000, delta * 1_000);
    samples.current.push(frameMs);
    if (samples.current.length > 240) samples.current.shift();
    const now = performance.now();
    if (now - lastReport.current < 1_000 || samples.current.length < 10) return;
    lastReport.current = now;
    const summary = summarizeFrameTimes(samples.current);
    const heap = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize;
    const interactive = performance.getEntriesByName('christmas-tree:time-to-interactive').at(-1) as PerformanceMeasure | undefined;
    onMetrics({
      ...summary,
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      textures: gl.info.memory.textures,
      geometries: gl.info.memory.geometries,
      dpr: gl.getPixelRatio(),
      width: Math.round(size.width * gl.getPixelRatio()),
      height: Math.round(size.height * gl.getPixelRatio()),
      timeToInteractiveMs: interactive?.duration ?? null,
      deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
      jsHeapMb: typeof heap === 'number' ? heap / 1024 / 1024 : null,
      contextLosses: contextLosses.current,
    });
  });

  return null;
};

const metric = (value: number, digits = 1) => value.toFixed(digits);

export const PerformanceDiagnosticsPanel: React.FC<{
  metrics: PerformanceMetrics | null;
  settings: DiagnosticSettings;
  activeQuality: PerformanceQuality;
  onChange: (settings: DiagnosticSettings) => void;
}> = ({ metrics, settings, activeQuality, onChange }) => {
  const toggle = (key: keyof Pick<DiagnosticSettings, 'effects' | 'dynamicLights' | 'automaticOrnaments' | 'giftsAndPhotos' | 'animations' | 'reducedDpr'>) => (
    onChange({ ...settings, [key]: !settings[key] })
  );
  const copy = () => {
    if (!metrics) return;
    void navigator.clipboard?.writeText(JSON.stringify({ quality: activeQuality, settings, metrics }, null, 2));
  };

  return (
    <aside style={{ position: 'fixed', zIndex: 140, top: 8, left: 8, width: 'min(92vw, 360px)', maxHeight: 'calc(100dvh - 16px)', overflow: 'auto', border: '1px solid rgba(255,241,161,.35)', borderRadius: 12, background: 'rgba(2,10,8,.94)', color: '#fff', padding: 10, font: '12px/1.35 ui-monospace, monospace', pointerEvents: 'auto' }}>
      <strong style={{ color: '#fff1a1' }}>Diagnóstico 3D — DEV</strong>
      <div style={{ marginTop: 6 }}>
        perfil: <b>{activeQuality}</b> · FPS {metrics ? metric(metrics.averageFps) : '—'} · mínimo {metrics ? metric(metrics.minimumFps) : '—'}<br />
        frame {metrics ? metric(metrics.averageFrameMs) : '—'} ms · p95 {metrics ? metric(metrics.p95FrameMs) : '—'} · p99 {metrics ? metric(metrics.p99FrameMs) : '—'}<br />
        calls {metrics?.drawCalls ?? '—'} · triângulos {metrics?.triangles.toLocaleString('pt-BR') ?? '—'}<br />
        geometrias {metrics?.geometries ?? '—'} · texturas {metrics?.textures ?? '—'} · DPR {metrics ? metric(metrics.dpr, 2) : '—'}<br />
        canvas {metrics ? `${metrics.width}×${metrics.height}` : '—'} · TTI {metrics?.timeToInteractiveMs != null ? `${metric(metrics.timeToInteractiveMs, 0)} ms` : '—'}<br />
        memória dispositivo {metrics?.deviceMemoryGb != null ? `${metrics.deviceMemoryGb} GB` : 'n/d'} · heap {metrics?.jsHeapMb != null ? `${metric(metrics.jsHeapMb)} MB` : 'n/d'} · context loss {metrics?.contextLosses ?? 0}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
        {(['auto', 'high', 'balanced', 'economy'] as const).map((quality) => <button key={quality} type="button" onClick={() => onChange({ ...settings, quality })} style={{ padding: '5px 7px', borderRadius: 7, border: '1px solid #fff1a155', color: settings.quality === quality ? '#07120d' : '#fff1a1', background: settings.quality === quality ? '#fff1a1' : 'transparent' }}>{quality}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 7 }}>
        <button type="button" onClick={() => toggle('effects')}>efeitos: {settings.effects ? 'on' : 'off'}</button>
        <button type="button" onClick={() => toggle('dynamicLights')}>luzes: {settings.dynamicLights ? 'on' : 'off'}</button>
        <button type="button" onClick={() => toggle('automaticOrnaments')}>automáticos: {settings.automaticOrnaments ? 'on' : 'off'}</button>
        <button type="button" onClick={() => toggle('giftsAndPhotos')}>fotos/presentes: {settings.giftsAndPhotos ? 'on' : 'off'}</button>
        <button type="button" onClick={() => toggle('animations')}>animações: {settings.animations ? 'on' : 'off'}</button>
        <button type="button" onClick={() => toggle('reducedDpr')}>DPR reduzido: {settings.reducedDpr ? 'on' : 'off'}</button>
      </div>
      <button type="button" onClick={copy} disabled={!metrics} style={{ width: '100%', marginTop: 7, padding: 6 }}>Copiar métricas</button>
    </aside>
  );
};

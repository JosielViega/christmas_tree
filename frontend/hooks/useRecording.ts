import { useCallback, useEffect, useRef, useState } from 'react';
import { PhotoData } from '../types';
import { downloadBlob } from '../utils/socialSharing';
import {
  STORY_VIDEO_DURATION_MS,
  VideoRecordingCancelledError,
  recordCanvasVideo,
} from '../utils/videoRecording';

export const useRecording = (photos: PhotoData[], onError?: (message: string) => void) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingType, setRecordingType] = useState<'FULL' | 'ALBUM' | null>(null);
  const active = useRef(false);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => () => abortController.current?.abort(), []);

  const handleRecordVideo = useCallback(async (type: 'FULL' | 'ALBUM') => {
    if (active.current) return;
    active.current = true;
    setIsRecording(true);
    setRecordingType(type);
    const controller = new AbortController();
    abortController.current = controller;

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('A árvore 3D ainda não está pronta para gravação.');
      const durationMs = type === 'FULL' ? STORY_VIDEO_DURATION_MS : Math.max(photos.length * 1_000, 2_000);
      const result = await recordCanvasVideo({
        canvas,
        durationMs,
        fps: 30,
        videoBitsPerSecond: 8_000_000,
        signal: controller.signal,
      });
      downloadBlob(result.blob, `christmas-tree-${type.toLowerCase()}.${result.extension}`);
    } catch (caught) {
      if (!(caught instanceof VideoRecordingCancelledError)) {
        onError?.(caught instanceof Error ? caught.message : 'Não foi possível gravar o vídeo.');
      }
    } finally {
      active.current = false;
      abortController.current = null;
      setIsRecording(false);
      setRecordingType(null);
    }
  }, [onError, photos.length]);

  return {
    isRecording,
    recordingType,
    handleRecordVideo,
  };
};

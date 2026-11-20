/// <reference types="vite/client" />

import type { ChristmasTreeBootstrap } from './types';

interface ImportMetaEnv {
  readonly VITE_ENABLE_GIFT_PREVIEW?: string;
  readonly VITE_GIFT_PHOTO_MAX_BYTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    __CHRISTMAS_TREE_BOOTSTRAP__?: ChristmasTreeBootstrap;
  }
}

export {};

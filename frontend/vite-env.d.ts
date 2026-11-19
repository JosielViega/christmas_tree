/// <reference types="vite/client" />

import type { ChristmasTreeBootstrap } from './types';

declare global {
  interface Window {
    __CHRISTMAS_TREE_BOOTSTRAP__?: ChristmasTreeBootstrap;
  }
}

export {};

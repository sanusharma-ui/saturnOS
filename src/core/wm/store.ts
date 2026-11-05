import { writable } from 'svelte/store';
import type { WindowInstance, SnapTarget } from './types';

export const windowsStore = writable<WindowInstance[]>([]);
export const activeWindowIdStore = writable<string | null>(null);
export const snapPreviewStore = writable<{ x: number; y: number; width: number; height: number; visible: boolean }>({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  visible: false
});

export const altTabStore = writable<{ active: boolean; index: number; list: WindowInstance[] }>({
  active: false,
  index: 0,
  list: []
});

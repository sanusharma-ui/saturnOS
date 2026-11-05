import type { AppManifest } from '../../core/registry/types';
import App from './App.svelte';

export const manifest: AppManifest = {
  id: 'clock',
  name: 'Clock',
  icon: 'clock',
  colors: ['#3b82f6', '#1d4ed8'],
  defaultWidth: 420,
  defaultHeight: 480,
  minWidth: 340,
  minHeight: 400,
  pinned: false,
  singleInstance: false,
  component: App
};

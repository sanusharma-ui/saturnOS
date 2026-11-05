import type { AppManifest } from '../../core/registry/types';
import App from './App.svelte';

export const manifest: AppManifest = {
  id: 'monitor',
  name: 'System Monitor',
  icon: 'monitor',
  colors: ['#34d399', '#059669'],
  defaultWidth: 640,
  defaultHeight: 480,
  minWidth: 380,
  minHeight: 280,
  pinned: true,
  singleInstance: true,
  component: App
};

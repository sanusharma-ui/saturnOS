import type { AppManifest } from '../../core/registry/types';
import App from './App.svelte';

export const manifest: AppManifest = {
  id: 'settings',
  name: 'Settings',
  icon: 'settings',
  colors: ['#94a3b8', '#64748b'],
  defaultWidth: 640,
  defaultHeight: 480,
  minWidth: 380,
  minHeight: 280,
  pinned: true,
  singleInstance: true,
  component: App
};

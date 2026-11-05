import type { AppManifest } from '../../core/registry/types';
import App from './App.svelte';

export const manifest: AppManifest = {
  id: 'terminal',
  name: 'Terminal',
  icon: 'terminal',
  colors: ['#1e293b', '#0f172a'],
  defaultWidth: 760,
  defaultHeight: 480,
  minWidth: 420,
  minHeight: 280,
  pinned: true,
  singleInstance: false,
  component: App
};

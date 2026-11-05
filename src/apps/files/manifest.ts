import type { AppManifest } from '../../core/registry/types';
import App from './App.svelte';

export const manifest: AppManifest = {
  id: 'files',
  name: 'Files',
  icon: 'files',
  colors: ['#4f8eff', '#2563eb'],
  defaultWidth: 780,
  defaultHeight: 520,
  minWidth: 400,
  minHeight: 280,
  pinned: true,
  singleInstance: false,
  component: App
};

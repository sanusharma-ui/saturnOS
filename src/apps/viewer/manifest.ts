import type { AppManifest } from '../../core/registry/types';
import App from './App.svelte';

export const manifest: AppManifest = {
  id: 'viewer',
  name: 'Media Viewer',
  icon: 'viewer',
  colors: ['#c084fc', '#9333ea'],
  defaultWidth: 680,
  defaultHeight: 480,
  minWidth: 320,
  minHeight: 220,
  singleInstance: false,
  component: App
};

import type { AppManifest } from '../../core/registry/types';
import App from './App.svelte';

export const manifest: AppManifest = {
  id: 'calendar',
  name: 'Calendar',
  icon: 'calendar',
  colors: ['#10b981', '#059669'],
  defaultWidth: 540,
  defaultHeight: 520,
  minWidth: 420,
  minHeight: 440,
  pinned: false,
  singleInstance: false,
  component: App
};

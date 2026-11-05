import type { AppManifest } from '../../core/registry/types';
import App from './App.svelte';

export const manifest: AppManifest = {
  id: 'calc',
  name: 'Calculator',
  icon: 'calc',
  colors: ['#f59e0b', '#d97706'],
  defaultWidth: 320,
  defaultHeight: 460,
  minWidth: 280,
  minHeight: 380,
  pinned: false,
  singleInstance: false,
  component: App
};

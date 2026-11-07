import type { AppManifest } from '../../core/registry/types';
import App from './App.svelte';

export const manifest: AppManifest = {
  id: 'browser',
  name: 'Web Browser',
  icon: 'browser',
  colors: ['#ea580c', '#c2410c'],
  component: App,
  singleInstance: false,
  defaultWidth: 920,
  defaultHeight: 600,
  pinned: true
};

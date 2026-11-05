import type { AppManifest } from '../../core/registry/types';
import App from './App.svelte';

export const manifest: AppManifest = {
  id: 'ai',
  name: 'Saturn AI',
  icon: 'ai',
  colors: ['#a855f7', '#6366f1'],
  defaultWidth: 580,
  defaultHeight: 540,
  minWidth: 360,
  minHeight: 300,
  pinned: true,
  singleInstance: true,
  component: App
};

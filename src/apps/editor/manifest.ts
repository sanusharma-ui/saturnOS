import type { AppManifest } from '../../core/registry/types';
import App from './App.svelte';

export const manifest: AppManifest = {
  id: 'editor',
  name: 'Text Editor',
  icon: 'editor',
  colors: ['#6b7280', '#4b5563'],
  defaultWidth: 720,
  defaultHeight: 500,
  minWidth: 380,
  minHeight: 250,
  pinned: true,
  singleInstance: true,
  component: App
};

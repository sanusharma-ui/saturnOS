import type { AppManifest } from '../../core/registry/types';

export const manifest: AppManifest = {
  id: 'browser',
  name: 'Web Browser',
  icon: 'browser',
  colors: ['#ea580c', '#c2410c'],
  isNative: true,
  command: 'browser',
  pinned: true
};

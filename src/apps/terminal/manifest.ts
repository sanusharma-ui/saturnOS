import type { AppManifest } from '../../core/registry/types';

export const manifest: AppManifest = {
  id: 'terminal',
  name: 'Terminal',
  icon: 'terminal',
  colors: ['#1e293b', '#0f172a'],
  isNative: true,
  command: 'terminal',
  pinned: true
};

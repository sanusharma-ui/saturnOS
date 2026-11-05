import type { AppManifest } from './types';
import { manifest as filesManifest } from '../../apps/files/manifest';
import { manifest as editorManifest } from '../../apps/editor/manifest';
import { manifest as viewerManifest } from '../../apps/viewer/manifest';
import { manifest as monitorManifest } from '../../apps/monitor/manifest';
import { manifest as settingsManifest } from '../../apps/settings/manifest';
import { manifest as aiManifest } from '../../apps/ai/manifest';
import { manifest as calcManifest } from '../../apps/calculator/manifest';
import { manifest as clockManifest } from '../../apps/clock/manifest';
import { manifest as calendarManifest } from '../../apps/calendar/manifest';
import { manifest as terminalManifest } from '../../apps/terminal/manifest';
import { manifest as browserManifest } from '../../apps/browser/manifest';

import { wmManager } from '../wm/manager';
import { api } from '../api/client';
import { notifications } from '../notifications/store';

export const APP_REGISTRY: Record<string, AppManifest> = {
  files: filesManifest,
  editor: editorManifest,
  viewer: viewerManifest,
  monitor: monitorManifest,
  settings: settingsManifest,
  ai: aiManifest,
  calc: calcManifest,
  calculator: calcManifest,
  clock: clockManifest,
  calendar: calendarManifest,
  terminal: terminalManifest,
  browser: browserManifest,
  media: viewerManifest,
  images: viewerManifest
};

export const appRegistry = {
  ...APP_REGISTRY,
  get: (id: string): AppManifest | undefined => APP_REGISTRY[id.toLowerCase()]
};

export const ALL_APPS: AppManifest[] = [
  filesManifest,
  editorManifest,
  viewerManifest,
  monitorManifest,
  settingsManifest,
  aiManifest,
  calcManifest,
  clockManifest,
  calendarManifest,
  terminalManifest,
  browserManifest
];

export function getAppManifest(id: string): AppManifest | undefined {
  return APP_REGISTRY[id.toLowerCase()];
}

export async function launchApp(appId: string, initialProps: Record<string, any> = {}): Promise<void> {
  const manifest = getAppManifest(appId);
  if (!manifest) {
    console.error(`App not found: ${appId}`);
    return;
  }

  if (manifest.isNative) {
    try {
      const res = await api.launch(manifest.command || appId);
      if (!res.ok) {
        notifications.add({
          title: 'Launch Failed',
          message: res.error || `Could not launch ${manifest.name}`,
          type: 'error'
        });
      }
    } catch (err: any) {
      notifications.add({
        title: 'Launch Error',
        message: err.message || `Failed to spawn ${manifest.name}`,
        type: 'error'
      });
    }
    return;
  }

  wmManager.open(manifest, initialProps);
}

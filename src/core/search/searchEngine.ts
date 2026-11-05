import { writable } from 'svelte/store';
import { ALL_APPS, launchApp } from '../registry/appRegistry';
import { api, type FileItem } from '../api/client';

export const searchOpenStore = writable<boolean>(false);
export const searchQueryStore = writable<string>('');

export interface SearchResult {
  id: string;
  type: 'app' | 'file';
  title: string;
  subtitle?: string;
  icon: string;
  action: () => void;
}

export async function searchEverything(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const results: SearchResult[] = [];

  // 1. Search Apps
  for (const app of ALL_APPS) {
    if (app.name.toLowerCase().includes(trimmed) || app.id.toLowerCase().includes(trimmed)) {
      results.push({
        id: `app-${app.id}`,
        type: 'app',
        title: app.name,
        subtitle: 'Application',
        icon: app.icon,
        action: () => launchApp(app.id)
      });
    }
  }

  // 2. Search Files if query >= 2 chars
  if (trimmed.length >= 2) {
    try {
      const fileRes = await api.fsSearch(trimmed);
      if (fileRes.ok && Array.isArray(fileRes.results)) {
        for (const item of fileRes.results.slice(0, 8)) {
          const isDir = item.isDir;
          const ext = item.name.split('.').pop()?.toLowerCase() || '';
          let icon = isDir ? 'folder' : 'file';
          let appToOpen = 'files';

          if (!isDir) {
            if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'mp3', 'wav', 'ogg', 'mp4', 'webm'].includes(ext)) {
              icon = ['mp4', 'webm'].includes(ext) ? 'file-video' : ['mp3', 'wav', 'ogg'].includes(ext) ? 'file-audio' : 'file-image';
              appToOpen = 'viewer';
            } else {
              icon = 'file-code';
              appToOpen = 'editor';
            }
          }

          results.push({
            id: `file-${item.path}`,
            type: 'file',
            title: item.name,
            subtitle: item.path,
            icon,
            action: () => {
              if (isDir) {
                launchApp('files', { initialPath: item.path });
              } else if (appToOpen === 'viewer') {
                launchApp('viewer', { filePath: item.path });
              } else {
                launchApp('editor', { initialFile: item.path });
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn('File search error:', e);
    }
  }

  return results;
}

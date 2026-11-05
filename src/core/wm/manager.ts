import { get } from 'svelte/store';
import { windowsStore, activeWindowIdStore, snapPreviewStore, altTabStore } from './store';
import type { WindowInstance, SnapTarget } from './types';
import type { AppManifest } from '../registry/types';
import { api } from '../api/client';

export const TASKBAR_HEIGHT = 46;

export function getAvailableHeight(): number {
  return typeof window !== 'undefined' ? window.innerHeight - TASKBAR_HEIGHT : 720;
}

let zIndexCounter = 100;

export function openApp(manifest: AppManifest, arg?: any): WindowInstance | null {
  if (manifest.isNative) {
    api.launch(manifest.command || manifest.id, typeof arg === 'string' && arg.startsWith('/') ? arg : undefined);
    return null;
  }

  const windows = get(windowsStore);

  // Single instance check
  if (manifest.singleInstance) {
    const existing = windows.find(w => w.appId === manifest.id);
    if (existing) {
      if (existing.minimized) restoreWindow(existing.id);
      focusWindow(existing.id);
      if (arg !== undefined) {
        updateWindowArg(existing.id, arg);
      }
      return existing;
    }
  }

  const width = manifest.defaultWidth || 720;
  const height = manifest.defaultHeight || 480;
  const stagger = (windows.length % 7) * 28;
  const x = Math.max(20, Math.min(window.innerWidth - width - 40, 70 + stagger));
  const y = Math.max(10, Math.min(getAvailableHeight() - height - 30, 36 + stagger));

  const newWin: WindowInstance = {
    id: 'win_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    appId: manifest.id,
    title: manifest.name,
    icon: manifest.icon,
    x,
    y,
    width,
    height,
    minWidth: manifest.minWidth || 320,
    minHeight: manifest.minHeight || 200,
    zIndex: ++zIndexCounter,
    minimized: false,
    maximized: false,
    snapSide: null,
    prevBounds: { x, y, width, height },
    arg
  };

  windowsStore.update(wins => [...wins, newWin]);
  activeWindowIdStore.set(newWin.id);
  return newWin;
}

export function focusWindow(id: string) {
  windowsStore.update(wins => {
    return wins.map(w => {
      if (w.id === id) {
        zIndexCounter += 2;
        return { ...w, zIndex: zIndexCounter, minimized: false };
      }
      return w;
    });
  });
  activeWindowIdStore.set(id);
}

export function minimizeWindow(id: string) {
  windowsStore.update(wins => {
    return wins.map(w => (w.id === id ? { ...w, minimized: true } : w));
  });

  const remaining = get(windowsStore)
    .filter(w => !w.minimized && w.id !== id)
    .sort((a, b) => b.zIndex - a.zIndex);

  activeWindowIdStore.set(remaining.length > 0 ? remaining[0].id : null);
}

export function restoreWindow(id: string) {
  focusWindow(id);
}

export function maximizeWindow(id: string) {
  const availH = getAvailableHeight();
  windowsStore.update(wins => {
    return wins.map(w => {
      if (w.id !== id) return w;
      if (w.maximized) {
        return {
          ...w,
          maximized: false,
          snapSide: null,
          x: w.prevBounds.x,
          y: w.prevBounds.y,
          width: w.prevBounds.width,
          height: w.prevBounds.height
        };
      } else {
        return {
          ...w,
          maximized: true,
          snapSide: null,
          prevBounds: { x: w.x, y: w.y, width: w.width, height: w.height },
          x: 0,
          y: 0,
          width: window.innerWidth,
          height: availH
        };
      }
    });
  });
}

export function snapWindow(id: string, side: 'left' | 'right' | 'top') {
  if (side === 'top') {
    maximizeWindow(id);
    return;
  }

  const availH = getAvailableHeight();
  const halfW = Math.floor(window.innerWidth / 2);

  windowsStore.update(wins => {
    return wins.map(w => {
      if (w.id !== id) return w;
      const prevBounds = !w.maximized && !w.snapSide ? { x: w.x, y: w.y, width: w.width, height: w.height } : w.prevBounds;

      return {
        ...w,
        maximized: false,
        snapSide: side,
        prevBounds,
        x: side === 'left' ? 0 : halfW,
        y: 0,
        width: side === 'left' ? halfW : window.innerWidth - halfW,
        height: availH
      };
    });
  });
}

export function closeWindow(id: string) {
  windowsStore.update(wins => wins.filter(w => w.id !== id));
  const remaining = get(windowsStore)
    .filter(w => !w.minimized)
    .sort((a, b) => b.zIndex - a.zIndex);

  activeWindowIdStore.set(remaining.length > 0 ? remaining[0].id : null);
}

export function updateWindowBounds(id: string, bounds: Partial<WindowInstance>) {
  windowsStore.update(wins => wins.map(w => (w.id === id ? { ...w, ...bounds } : w)));
}

export function updateWindowArg(id: string, arg: any) {
  windowsStore.update(wins => wins.map(w => (w.id === id ? { ...w, arg } : w)));
}

export function showSnapPreview(x: number, y: number, width: number, height: number) {
  snapPreviewStore.set({ x, y, width, height, visible: true });
}

export function hideSnapPreview() {
  snapPreviewStore.update(p => ({ ...p, visible: false }));
}

// Alt + Tab Switcher
export function startAltTab(reverse = false) {
  const list = [...get(windowsStore)].sort((a, b) => b.zIndex - a.zIndex);
  if (list.length === 0) return;
  const index = list.length === 1 ? 0 : reverse ? list.length - 1 : 1;
  altTabStore.set({ active: true, index, list });
}

export function cycleAltTab(reverse = false) {
  altTabStore.update(state => {
    if (!state.active || state.list.length <= 1) return state;
    const len = state.list.length;
    const index = reverse ? (state.index - 1 + len) % len : (state.index + 1) % len;
    return { ...state, index };
  });
}

export function commitAltTab() {
  const state = get(altTabStore);
  if (!state.active) return;
  const target = state.list[state.index];
  if (target) {
    if (target.minimized) restoreWindow(target.id);
    focusWindow(target.id);
  }
  altTabStore.set({ active: false, index: 0, list: [] });
}

export function cancelAltTab() {
  altTabStore.set({ active: false, index: 0, list: [] });
}

export const wmManager = {
  open: openApp,
  openApp,
  focus: focusWindow,
  focusWindow,
  minimize: minimizeWindow,
  minimizeWindow,
  restore: restoreWindow,
  restoreWindow,
  maximize: maximizeWindow,
  maximizeWindow,
  snap: snapWindow,
  snapWindow,
  close: closeWindow,
  closeWindow,
  updateWindowBounds,
  updateWindowArg,
  showSnapPreview,
  hideSnapPreview,
  startAltTab,
  cycleAltTab,
  commitAltTab,
  cancelAltTab
};

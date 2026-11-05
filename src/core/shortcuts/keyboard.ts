import { get } from 'svelte/store';
import { activeWindowIdStore, altTabStore } from '../wm/store';
import { wmManager } from '../wm/manager';
import { contextMenuStore } from '../contextmenu/store';

export type ShortcutCallbacks = {
  toggleLauncher?: () => void;
  closeLauncher?: () => void;
  toggleQuickSettings?: () => void;
  closeQuickSettings?: () => void;
};

let callbacks: ShortcutCallbacks = {};

export function registerShortcutCallbacks(cb: ShortcutCallbacks) {
  callbacks = { ...callbacks, ...cb };
}

export function setupKeyboardShortcuts() {
  if (typeof window === 'undefined') return () => {};

  const handleKeyDown = (e: KeyboardEvent) => {
    // 1. Alt + Tab
    if (e.altKey && e.key === 'Tab') {
      e.preventDefault();
      const state = get(altTabStore);
      if (!state.active) {
        wmManager.startAltTab(e.shiftKey);
      } else {
        wmManager.cycleAltTab(e.shiftKey);
      }
      return;
    }

    // 2. Alt + F4
    if (e.altKey && e.key === 'F4') {
      e.preventDefault();
      const activeId = get(activeWindowIdStore);
      if (activeId) {
        wmManager.close(activeId);
      }
      return;
    }

    // 3. Escape
    if (e.key === 'Escape') {
      const altState = get(altTabStore);
      if (altState.active) {
        e.preventDefault();
        wmManager.cancelAltTab();
        return;
      }
      contextMenuStore.close();
      callbacks.closeLauncher?.();
      callbacks.closeQuickSettings?.();
      return;
    }

    // 4. Meta / Super / Ctrl+Space (Launcher)
    if ((e.key === 'Meta' || (e.ctrlKey && e.code === 'Space')) && !e.altKey) {
      // If no input is focused or Ctrl+Space
      if (e.code === 'Space' || document.activeElement === document.body || document.activeElement?.tagName === 'BUTTON') {
        e.preventDefault();
        callbacks.toggleLauncher?.();
        return;
      }
    }

    // 5. Meta + Arrow Keys (Window Snapping & Maximize)
    if (e.metaKey || (e.altKey && e.ctrlKey)) {
      const activeId = get(activeWindowIdStore);
      if (!activeId) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        wmManager.maximize(activeId);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        wmManager.minimize(activeId);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        wmManager.snap(activeId, 'left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        wmManager.snap(activeId, 'right');
      }
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    // When Alt is released during Alt-Tab
    if (e.key === 'Alt') {
      const state = get(altTabStore);
      if (state.active) {
        wmManager.commitAltTab();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}

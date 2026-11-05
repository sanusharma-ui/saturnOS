import { writable } from 'svelte/store';

export interface ContextMenuItem {
  label?: string;
  icon?: string;
  action?: () => void;
  disabled?: boolean;
  submenu?: ContextMenuItem[];
  separator?: boolean;
  shortcut?: string;
  danger?: boolean;
}

export interface ContextMenuState {
  visible: boolean;
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}

const innerStore = writable<ContextMenuState>({
  visible: false,
  open: false,
  x: 0,
  y: 0,
  items: []
});

export function openContextMenu(x: number, y: number, items: ContextMenuItem[]) {
  const width = 190;
  const height = items.length * 30;
  const safeX = typeof window !== 'undefined' ? Math.max(6, Math.min(window.innerWidth - width - 10, x)) : x;
  const safeY = typeof window !== 'undefined' ? Math.max(6, Math.min(window.innerHeight - height - 10, y)) : y;

  innerStore.set({
    visible: true,
    open: true,
    x: safeX,
    y: safeY,
    items
  });
}

export function closeContextMenu() {
  innerStore.update(s => ({ ...s, visible: false, open: false }));
}

export const contextMenuStore = {
  subscribe: innerStore.subscribe,
  set: innerStore.set,
  update: innerStore.update,
  open: (x: number, y: number, items: ContextMenuItem[]) => openContextMenu(x, y, items),
  close: () => closeContextMenu()
};

import { writable } from 'svelte/store';

export interface ToastItem {
  id: number;
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'warn' | 'error';
  time: string;
}

function loadHistory(): ToastItem[] {
  try {
    const saved = localStorage.getItem('saturn.notifications');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

export const toastsStore = writable<ToastItem[]>([]);
export const notificationHistoryStore = writable<ToastItem[]>(loadHistory());

export function showToast(title: string, message = '', type: 'info' | 'success' | 'warn' | 'error' = 'info', duration = 4000) {
  const item: ToastItem = {
    id: Date.now() + Math.random(),
    title,
    message,
    type,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  toastsStore.update(list => [...list, item]);
  notificationHistoryStore.update(hist => {
    const next = [item, ...hist].slice(0, 20);
    try {
      localStorage.setItem('saturn.notifications', JSON.stringify(next));
    } catch (e) {}
    return next;
  });

  setTimeout(() => {
    toastsStore.update(list => list.filter(t => t.id !== item.id));
  }, duration);
}

export function clearNotificationHistory() {
  notificationHistoryStore.set([]);
  try {
    localStorage.removeItem('saturn.notifications');
  } catch (e) {}
}

export const notifications = {
  subscribe: toastsStore.subscribe,
  add: (opts: { title: string; message?: string; type?: 'info' | 'success' | 'warn' | 'error'; duration?: number }) => {
    showToast(opts.title, opts.message || '', opts.type || 'info', opts.duration || 4000);
  },
  remove: (id: number) => {
    toastsStore.update(list => list.filter(t => t.id !== id));
  },
  clear: () => {
    toastsStore.set([]);
  }
};

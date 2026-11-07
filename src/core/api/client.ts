/**
 * Saturn OS - Core API Client
 */

export interface SysInfo {
  cpu: number;
  cores: number;
  mem: { total: number; avail: number };
  disk: { total: number; free: number };
  uptime: number;
  kernel: string;
  hostname: string;
  battery: { present: boolean; percent: number; charging: boolean; capacity?: number; status?: string } | null;
  network: { online: boolean };
  procs: Array<{ pid: number; name: string; cpu: number; mem: number }>;
}

export interface FsInfo {
  home: string;
  desktop: string;
  documents: string;
  downloads: string;
  pictures: string;
  music: string;
  videos: string;
  trash: string;
  platform: 'win32' | 'linux' | 'darwin';
  sep: string;
  username: string;
}

export interface FileItem {
  name: string;
  path: string;
  type?: 'dir' | 'file';
  isDir?: boolean;
  size?: number;
  mtime?: number;
  ext?: string;
  hidden?: boolean;
  originalPath?: string;
  deletedAt?: number;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isPost = options.method === 'POST';
  const headers = new Headers(options.headers || {});
  if (isPost && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(endpoint, {
    ...options,
    headers
  });

  let json: any = {};
  try {
    json = await res.json();
  } catch (e) {}

  if (!res.ok) {
    throw new ApiError(res.status, json.error || `HTTP ${res.status}`);
  }

  return json as T;
}

export const api = {
  getSysinfo: () => request<SysInfo>('/api/sysinfo'),
  sysinfo: async () => {
    try {
      const data = await request<SysInfo>('/api/sysinfo');
      return { ok: true, ...data };
    } catch (e: any) {
      return { ok: false, error: e.message, battery: null };
    }
  },
  getFsInfo: () => request<FsInfo>('/api/fs/info'),
  fsInfo: async () => {
    try {
      return await request<FsInfo>('/api/fs/info');
    } catch (e: any) {
      return null;
    }
  },
  listFiles: (path: string, showHidden = false) =>
    request<{ path: string; items: FileItem[] }>(`/api/fs/list?path=${encodeURIComponent(path)}${showHidden ? '&hidden=1' : ''}`),
  readFile: (path: string) =>
    request<{ path: string; content: string; size?: number; mtime?: number }>(`/api/fs/read?path=${encodeURIComponent(path)}`),
  writeFile: (path: string, content: string) =>
    request<{ ok: boolean; path?: string; name?: string; size?: number }>('/api/fs/write', { method: 'POST', body: JSON.stringify({ path, content }) }),
  fsWrite: (path: string, content: string) =>
    request<{ ok: boolean; path?: string; name?: string }>('/api/fs/write', { method: 'POST', body: JSON.stringify({ path, content }) }),
  createItem: (dir: string, type: 'file' | 'dir', name?: string, content = '') =>
    request<{ ok: boolean; path: string; name: string; type: 'file' | 'dir'; isDir: boolean; size: number; mtime: number }>('/api/fs/create', {
      method: 'POST',
      body: JSON.stringify({ dir, type, name, content })
    }),
  mkdir: (path: string, name?: string) =>
    request<{ ok: boolean; path?: string; name?: string; isDir?: boolean }>('/api/fs/mkdir', { method: 'POST', body: JSON.stringify({ path, name: name || '' }) }),
  fsMkdir: (path: string, name?: string) =>
    request<{ ok: boolean; path?: string; name?: string }>('/api/fs/mkdir', { method: 'POST', body: JSON.stringify({ path, name: name || '' }) }),
  duplicateItem: (path: string) =>
    request<{ ok: boolean; path: string; name: string; type: 'file' | 'dir'; size: number }>('/api/fs/duplicate', { method: 'POST', body: JSON.stringify({ path }) }),
  rename: (path: string, name: string) =>
    request<{ ok: boolean; path?: string; name?: string }>('/api/fs/rename', { method: 'POST', body: JSON.stringify({ path, name }) }),
  deleteItem: (path: string, emptyTrash = false, permanent = false) =>
    request<{ ok: boolean; trashed?: boolean; permanent?: boolean; emptied?: boolean }>('/api/fs/delete', { method: 'POST', body: JSON.stringify({ path, emptyTrash, permanent }) }),
  restoreItem: (path: string) =>
    request<{ ok: boolean; path: string; name: string }>('/api/fs/restore', { method: 'POST', body: JSON.stringify({ path }) }),
  copyItem: (src: string, dest: string) =>
    request<{ ok: boolean; path?: string; name?: string }>('/api/fs/copy', { method: 'POST', body: JSON.stringify({ src, dest }) }),
  moveItem: (src: string, dest: string) =>
    request<{ ok: boolean; path?: string; name?: string; noop?: boolean }>('/api/fs/move', { method: 'POST', body: JSON.stringify({ src, dest }) }),
  searchFiles: (q: string, path = '') =>
    request<{ results: Array<{ name: string; path: string; type: 'dir' | 'file'; isDir?: boolean }> }>(`/api/fs/search?q=${encodeURIComponent(q)}&path=${encodeURIComponent(path)}`),
  fsSearch: async (q: string, path = '') => {
    try {
      const data = await request<{ results: Array<{ name: string; path: string; type: 'dir' | 'file'; isDir?: boolean }> }>(`/api/fs/search?q=${encodeURIComponent(q)}&path=${encodeURIComponent(path)}`);
      return {
        ok: true,
        results: (data.results || []).map(r => ({
          name: r.name,
          path: r.path,
          type: r.type,
          isDir: r.type === 'dir'
        }))
      };
    } catch (e: any) {
      return { ok: false, results: [] };
    }
  },
  launch: (app: string, path?: string) =>
    request<{ ok: boolean; error?: string }>('/api/launch', { method: 'POST', body: JSON.stringify({ app, path }) }),
  power: (action: 'shutdown' | 'reboot' | 'logout' | 'poweroff') =>
    request<{ ok: boolean }>('/api/power', { method: 'POST', body: JSON.stringify({ action: action === 'poweroff' ? 'shutdown' : action }) }),
  llmHealth: async () => {
    const res = await fetch('/api/llm/health');
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  },
  getTerminalSessions: () =>
    request<{ ok: boolean; sessions: Array<{ sessionId: string; shell: string; cwd?: string; pid: number; startedAt: number; active: boolean; cols?: number; rows?: number }> }>('/api/terminal/sessions'),
  killTerminalSession: (sessionId: string, signal?: string) =>
    request<{ ok: boolean; sessionId: string }>('/api/terminal/kill', { method: 'POST', body: JSON.stringify({ sessionId, signal }) })
};

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

export interface FileItem {
  name: string;
  path: string;
  type?: 'dir' | 'file';
  isDir?: boolean;
  size?: number;
  mtime?: number;
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
  listFiles: (path: string) => request<{ path: string; items: any[] }>(`/api/fs/list?path=${encodeURIComponent(path)}`),
  readFile: (path: string) => request<{ path: string; content: string }>(`/api/fs/read?path=${encodeURIComponent(path)}`),
  writeFile: (path: string, content: string) => request<{ ok: boolean }>('/api/fs/write', { method: 'POST', body: JSON.stringify({ path, content }) }),
  fsWrite: (path: string, content: string) => request<{ ok: boolean }>('/api/fs/write', { method: 'POST', body: JSON.stringify({ path, content }) }),
  mkdir: (path: string, name?: string) => request<{ ok: boolean; path?: string; name?: string }>('/api/fs/mkdir', { method: 'POST', body: JSON.stringify({ path, name: name || '' }) }),
  fsMkdir: (path: string, name?: string) => request<{ ok: boolean; path?: string; name?: string }>('/api/fs/mkdir', { method: 'POST', body: JSON.stringify({ path, name: name || '' }) }),
  rename: (path: string, name: string) => request<{ ok: boolean }>('/api/fs/rename', { method: 'POST', body: JSON.stringify({ path, name }) }),
  deleteItem: (path: string, emptyTrash = false) => request<{ ok: boolean }>('/api/fs/delete', { method: 'POST', body: JSON.stringify({ path, emptyTrash }) }),
  copyItem: (src: string, dest: string) => request<{ ok: boolean }>('/api/fs/copy', { method: 'POST', body: JSON.stringify({ src, dest }) }),
  moveItem: (src: string, dest: string) => request<{ ok: boolean }>('/api/fs/move', { method: 'POST', body: JSON.stringify({ src, dest }) }),
  searchFiles: (q: string, path = '') => request<{ results: Array<{ name: string; path: string; type: 'dir' | 'file'; isDir?: boolean }> }>(`/api/fs/search?q=${encodeURIComponent(q)}&path=${encodeURIComponent(path)}`),
  fsSearch: async (q: string, path = '') => {
    try {
      const data = await request<{ results: Array<{ name: string; path: string; type: 'dir' | 'file' }> }>(`/api/fs/search?q=${encodeURIComponent(q)}&path=${encodeURIComponent(path)}`);
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
  launch: (app: string, path?: string) => request<{ ok: boolean; error?: string }>('/api/launch', { method: 'POST', body: JSON.stringify({ app, path }) }),
  power: (action: 'shutdown' | 'reboot' | 'logout' | 'poweroff') => request<{ ok: boolean }>('/api/power', { method: 'POST', body: JSON.stringify({ action: action === 'poweroff' ? 'shutdown' : action }) }),
  llmHealth: async () => {
    const res = await fetch('/api/llm/health');
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  },
  getTerminalSessions: () => request<{ ok: boolean; sessions: Array<{ sessionId: string; shell: string; pid: number; startedAt: number; active: boolean }> }>('/api/terminal/sessions'),
  killTerminalSession: (sessionId: string, signal?: string) => request<{ ok: boolean; sessionId: string }>('/api/terminal/kill', { method: 'POST', body: JSON.stringify({ sessionId, signal }) })
};

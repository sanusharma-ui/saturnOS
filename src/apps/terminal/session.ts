/**
 * Saturn OS - Terminal Client Session & WebSocket Adapter
 * Manages bi-directional WebSocket streaming, buffered inputs,
 * auto-reconnect, and session lifecycle.
 */

import type { TerminalClientMsg, TerminalServerMsg, TerminalSessionInfo } from '../../core/terminal/types';

export type SessionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface TerminalSessionOptions {
  sessionId?: string;
  shell?: string;
  cwd?: string;
  cols?: number;
  rows?: number;
  onOutput?: (data: string) => void;
  onReady?: (info: TerminalSessionInfo) => void;
  onExit?: (code: number, signal?: string) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: SessionState) => void;
}

export class TerminalSessionClient {
  public id: string;
  public state: SessionState = 'disconnected';
  public sessionInfo: TerminalSessionInfo | null = null;

  private ws: WebSocket | null = null;
  private options: TerminalSessionOptions;
  private inputQueue: string[] = [];
  private pingInterval: any = null;
  private reconnectTimer: any = null;
  private shouldReconnect = true;

  constructor(options: TerminalSessionOptions = {}) {
    this.options = options;
    this.id = options.sessionId || `term_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    this.shouldReconnect = true;
    this.setState('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || '127.0.0.1:3000';
    let url = `${protocol}//${host}/api/terminal/ws?id=${encodeURIComponent(this.id)}`;
    if (this.options.shell) {
      url += `&shell=${encodeURIComponent(this.options.shell)}`;
    }
    if (this.options.cwd) {
      url += `&cwd=${encodeURIComponent(this.options.cwd)}`;
    }
    if (this.options.cols) {
      url += `&cols=${this.options.cols}`;
    }
    if (this.options.rows) {
      url += `&rows=${this.options.rows}`;
    }

    try {
      this.ws = new WebSocket(url);
      this.setupSocketListeners();
    } catch (err: any) {
      this.setState('error');
      this.options.onError?.(err.message || 'Failed to initialize WebSocket');
      this.scheduleReconnect();
    }
  }

  private setupSocketListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.setState('connected');
      this.flushQueue();
      this.startHeartbeat();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: TerminalServerMsg = JSON.parse(event.data);
        this.handleServerMessage(msg);
      } catch (err) {
        // Fallback for raw text stream
        if (typeof event.data === 'string') {
          this.options.onOutput?.(event.data);
        }
      }
    };

    this.ws.onerror = () => {
      this.setState('error');
      this.options.onError?.('Terminal socket error');
    };

    this.ws.onclose = () => {
      this.setState('disconnected');
      this.stopHeartbeat();
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };
  }

  private handleServerMessage(msg: TerminalServerMsg): void {
    if (msg.type === 'ready') {
      this.sessionInfo = {
        sessionId: msg.sessionId,
        shell: msg.shell,
        pid: msg.pid,
        startedAt: Date.now(),
        active: true
      };
      this.options.onReady?.(this.sessionInfo);
    } else if (msg.type === 'output') {
      this.options.onOutput?.(msg.data);
    } else if (msg.type === 'exit') {
      if (this.sessionInfo) this.sessionInfo.active = false;
      this.options.onExit?.(msg.code, msg.signal);
    } else if (msg.type === 'error') {
      this.options.onError?.(msg.message);
    }
  }

  public send(data: string): void {
    if (this.state === 'connected' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: TerminalClientMsg = { type: 'input', data };
      this.ws.send(JSON.stringify(msg));
    } else {
      this.inputQueue.push(data);
    }
  }

  public sendSignal(signal: 'SIGINT' | 'SIGKILL' | 'SIGTERM'): void {
    if (this.state === 'connected' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: TerminalClientMsg = { type: 'signal', signal };
      this.ws.send(JSON.stringify(msg));
    }
  }

  public resize(cols: number, rows: number): void {
    if (this.state === 'connected' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: TerminalClientMsg = { type: 'resize', cols, rows };
      this.ws.send(JSON.stringify(msg));
    }
  }

  private flushQueue(): void {
    while (this.inputQueue.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const data = this.inputQueue.shift();
      if (data !== undefined) {
        const msg: TerminalClientMsg = { type: 'input', data };
        this.ws.send(JSON.stringify(msg));
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const msg: TerminalClientMsg = { type: 'ping' };
        this.ws.send(JSON.stringify(msg));
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect) {
        this.connect();
      }
    }, 2500);
  }

  private setState(state: SessionState): void {
    this.state = state;
    this.options.onStateChange?.(state);
  }

  public disconnect(): void {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
  }
}

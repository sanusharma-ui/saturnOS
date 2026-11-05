/**
 * Saturn OS - Terminal Protocol & Types
 */

export type TerminalClientMsg =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'signal'; signal: 'SIGINT' | 'SIGKILL' | 'SIGTERM' }
  | { type: 'ping' };

export type TerminalServerMsg =
  | { type: 'ready'; sessionId: string; shell: string; pid: number }
  | { type: 'output'; data: string }
  | { type: 'exit'; code: number; signal?: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };

export interface TerminalSessionInfo {
  sessionId: string;
  shell: string;
  pid: number;
  startedAt: number;
  active: boolean;
}

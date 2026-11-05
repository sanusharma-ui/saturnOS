'use strict';

const cp = require('child_process');
const os = require('os');
const { RH } = require('./paths');

function resolveDefaultShell() {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }
  if (process.env.SHELL) {
    return process.env.SHELL;
  }
  return '/bin/sh';
}

class TerminalSession {
  constructor(id, onOutput, onExit) {
    this.id = id;
    this.onOutput = onOutput;
    this.onExit = onExit;
    this.startedAt = Date.now();
    this.active = false;
    this.shell = resolveDefaultShell();
    this.process = null;

    this.spawn();
  }

  spawn() {
    const isWin = process.platform === 'win32';
    const shellArgs = isWin ? [] : ['-i'];

    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      HOME: RH,
      USER: process.env.USER || 'sanu'
    };

    try {
      this.process = cp.spawn(this.shell, shellArgs, {
        cwd: RH,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      this.active = true;

      this.process.stdout.on('data', chunk => {
        if (this.onOutput) this.onOutput(chunk.toString('utf8'));
      });

      this.process.stderr.on('data', chunk => {
        if (this.onOutput) this.onOutput(chunk.toString('utf8'));
      });

      this.process.on('close', (code, signal) => {
        this.active = false;
        if (this.onExit) this.onExit(code ?? 0, signal);
      });

      this.process.on('error', err => {
        if (this.onOutput) this.onOutput(`\r\n[Process Error: ${err.message}]\r\n`);
        this.active = false;
        if (this.onExit) this.onExit(1);
      });
    } catch (err) {
      this.active = false;
      if (this.onOutput) this.onOutput(`\r\n[Failed to spawn shell: ${err.message}]\r\n`);
      if (this.onExit) this.onExit(1);
    }
  }

  write(data) {
    if (this.active && this.process && this.process.stdin.writable) {
      try {
        this.process.stdin.write(data);
      } catch (e) {}
    }
  }

  kill(signal = 'SIGTERM') {
    if (this.active && this.process) {
      try {
        this.process.kill(signal);
      } catch (e) {}
      this.active = false;
    }
  }

  getInfo() {
    return {
      sessionId: this.id,
      shell: this.shell,
      pid: this.process ? this.process.pid : 0,
      startedAt: this.startedAt,
      active: this.active
    };
  }
}

class TerminalSessionManager {
  constructor() {
    this.sessions = new Map();
  }

  create(id, onOutput, onExit) {
    if (this.sessions.has(id)) {
      this.destroy(id);
    }
    const session = new TerminalSession(id, onOutput, onExit);
    this.sessions.set(id, session);
    return session;
  }

  get(id) {
    return this.sessions.get(id);
  }

  write(id, data) {
    const session = this.get(id);
    if (session) {
      session.write(data);
      return true;
    }
    return false;
  }

  kill(id, signal) {
    const session = this.get(id);
    if (session) {
      session.kill(signal);
      return true;
    }
    return false;
  }

  destroy(id) {
    const session = this.get(id);
    if (session) {
      session.kill();
      this.sessions.delete(id);
      return true;
    }
    return false;
  }

  destroyAll() {
    for (const [id, session] of this.sessions.entries()) {
      session.kill();
    }
    this.sessions.clear();
  }
}

const terminalSessionManager = new TerminalSessionManager();

module.exports = {
  TerminalSession,
  TerminalSessionManager,
  terminalSessionManager
};

'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const { RH, resolveSafePath } = require('./paths');

function resolveShell(requestedShell) {
  const isWin = process.platform === 'win32';

  if (isWin) {
    if (requestedShell) {
      const lower = requestedShell.toLowerCase();
      if (lower.includes('cmd')) return { cmd: 'cmd.exe', args: [] };
      if (lower.includes('powershell') || lower.includes('pwsh')) {
        return { cmd: 'powershell.exe', args: ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass'] };
      }
      if (lower.includes('bash')) {
        // Check for Git Bash or WSL bash
        const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
        if (fs.existsSync(gitBash)) return { cmd: gitBash, args: ['-i'] };
      }
    }
    // Default to PowerShell on Windows for real PC power
    return { cmd: 'powershell.exe', args: ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass'] };
  }

  // POSIX (Linux / Alpine / macOS)
  if (requestedShell) {
    return { cmd: requestedShell, args: ['-i'] };
  }
  if (process.env.SHELL && fs.existsSync(process.env.SHELL)) {
    return { cmd: process.env.SHELL, args: ['-i'] };
  }
  if (fs.existsSync('/bin/bash')) {
    return { cmd: '/bin/bash', args: ['-i'] };
  }
  return { cmd: '/bin/sh', args: ['-i'] };
}

class TerminalSession {
  constructor(id, onOutput, onExit, options = {}) {
    this.id = id;
    this.onOutput = onOutput;
    this.onExit = onExit;
    this.startedAt = Date.now();
    this.active = false;
    this.cols = options.cols || 80;
    this.rows = options.rows || 24;

    // Resolve working directory
    let workingDir = RH;
    if (options.cwd) {
      try {
        workingDir = resolveSafePath(options.cwd, true);
        const stat = fs.statSync(workingDir);
        if (!stat.isDirectory()) workingDir = RH;
      } catch (e) {
        workingDir = RH;
      }
    }
    this.cwd = workingDir;

    // Resolve shell
    const { cmd, args } = resolveShell(options.shell);
    this.shell = cmd;
    this.shellArgs = args;
    this.process = null;

    this.spawn();
  }

  spawn() {
    const isWin = process.platform === 'win32';
    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      LANG: 'en_US.UTF-8',
      COLUMNS: String(this.cols),
      LINES: String(this.rows),
      HOME: RH,
      USER: process.env.USER || 'sanu'
    };

    try {
      this.process = cp.spawn(this.shell, this.shellArgs, {
        cwd: this.cwd,
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

  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    // Update env variables for subsequent subprocesses
    if (this.process && this.process.env) {
      this.process.env.COLUMNS = String(cols);
      this.process.env.LINES = String(rows);
    }
  }

  kill(signal = 'SIGTERM') {
    if (this.active && this.process) {
      if (signal === 'SIGINT' && process.platform === 'win32') {
        // On Windows, send Ctrl+C byte (\x03) into stdin to break running command
        try {
          this.process.stdin.write('\x03');
        } catch (e) {}
        return;
      }
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
      cwd: this.cwd,
      pid: this.process ? this.process.pid : 0,
      startedAt: this.startedAt,
      active: this.active,
      cols: this.cols,
      rows: this.rows
    };
  }
}

class TerminalSessionManager {
  constructor() {
    this.sessions = new Map();
  }

  create(id, onOutput, onExit, options = {}) {
    if (this.sessions.has(id)) {
      this.destroy(id);
    }
    const session = new TerminalSession(id, onOutput, onExit, options);
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

  resize(id, cols, rows) {
    const session = this.get(id);
    if (session) {
      session.resize(cols, rows);
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
      session.kill('SIGKILL');
      this.sessions.delete(id);
      return true;
    }
    return false;
  }

  destroyAll() {
    for (const [, session] of this.sessions.entries()) {
      session.kill('SIGKILL');
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

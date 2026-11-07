'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const { ApiError, resolveSafePath } = require('../lib/paths');

const ALLOWED_APPS = {
  terminal: ['xfce4-terminal', 'xterm', 'alacritty', 'sh'],
  files: ['thunar', 'pcmanfm', 'nautilus'],
  browser: ['chromium', 'chromium-browser', 'google-chrome', 'firefox'],
  chromium: ['chromium', 'chromium-browser', 'google-chrome']
};

function resolveBinary(candidates) {
  if (process.platform === 'win32') {
    return candidates[0];
  }
  for (const cmd of candidates) {
    if (cmd.startsWith('/')) {
      if (fs.existsSync(cmd)) return cmd;
    } else {
      for (const prefix of ['/usr/bin/', '/usr/local/bin/', '/bin/']) {
        if (fs.existsSync(prefix + cmd)) return prefix + cmd;
      }
    }
  }
  return candidates[0];
}

function spawnDetachedApp(command, args = []) {
  try {
    const isWin = process.platform === 'win32';

    if (isWin) {
      if (command === 'browser' || command === 'chromium') {
        cp.spawn('cmd.exe', ['/c', 'start', 'chrome'], { detached: true, stdio: 'ignore' }).unref();
        return;
      }
    }

    const binary = resolveBinary(Array.isArray(command) ? command : [command]);
    const spawnArgs = [...args];
    // If launching chromium on Alpine VM, pass friendly flags
    if (binary.includes('chromium') || binary.includes('chrome')) {
      spawnArgs.push('--no-sandbox', '--disable-dev-shm-usage');
    }

    const child = cp.spawn(binary, spawnArgs, {
      detached: true,
      stdio: 'ignore',
      env: Object.assign({}, process.env, { DISPLAY: process.env.DISPLAY || ':0' })
    });

    child.on('error', err => {
      console.error(`Failed to spawn ${binary}:`, err.message);
    });

    child.unref();
  } catch (e) {
    console.error(`Spawn error:`, e.message);
  }
}

function handleLaunchPost(body) {
  const appConfig = ALLOWED_APPS[body.app];
  if (!appConfig) throw new ApiError(400, 'Application not in launch allowlist');

  let args = [];
  if (body.path) {
    try {
      let target = resolveSafePath(body.path);
      const stat = fs.statSync(target);
      if (!stat.isDirectory()) target = path.dirname(target);
      if (body.app === 'terminal') args = ['--working-directory=' + target];
      else if (body.app === 'files') args = [target];
    } catch (e) {}
  }

  spawnDetachedApp(appConfig, args);
  return { ok: true };
}

module.exports = {
  handleLaunchPost
};

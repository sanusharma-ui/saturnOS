'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const { ApiError, resolveSafePath } = require('../lib/paths');

const ALLOWED_APPS = {
  terminal: ['xfce4-terminal'],
  files: ['thunar'],
  browser: ['firefox'],
  chromium: ['chromium']
};

function spawnDetachedApp(command, args) {
  try {
    const child = cp.spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      env: Object.assign({}, process.env, { DISPLAY: ':0' })
    });
    child.on('error', err => {
      console.error(`Failed to spawn ${command}:`, err.message);
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

  spawnDetachedApp(appConfig[0], args);
  return { ok: true };
}

module.exports = {
  handleLaunchPost
};

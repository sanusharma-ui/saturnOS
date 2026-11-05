'use strict';

const cp = require('child_process');
const { ApiError } = require('../lib/paths');

function spawnDetached(cmd, args) {
  try {
    const child = cp.spawn(cmd, args, {
      detached: true,
      stdio: 'ignore'
    });
    child.on('error', () => {});
    child.unref();
  } catch (e) {}
}

function handlePowerPost(body) {
  const action = body.action;
  if (action === 'shutdown' || action === 'poweroff') {
    spawnDetached('doas', ['poweroff']);
    return { ok: true, action: 'shutdown' };
  }
  if (action === 'reboot') {
    spawnDetached('doas', ['reboot']);
    return { ok: true, action };
  }
  if (action === 'logout') {
    spawnDetached('pkill', ['-f', '/usr/local/bin/saturn-session']);
    return { ok: true, action };
  }
  throw new ApiError(400, 'Invalid power action. Allowed: shutdown, reboot, logout');
}

module.exports = {
  handlePowerPost
};

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { RH } = require('./paths');

let prevCpuTimes = null;
let prevProcMap = new Map();
let prevProcTime = Date.now();

function getCpuUsage() {
  try {
    if (!fs.existsSync('/proc/stat')) return 0.0;
    const content = fs.readFileSync('/proc/stat', 'utf8');
    const firstLine = content.split('\n')[0];
    const parts = firstLine.trim().split(/\s+/).slice(1).map(Number);
    const idle = parts[3] + (parts[4] || 0);
    const total = parts.reduce((acc, v) => acc + v, 0);

    let usage = 0.0;
    if (prevCpuTimes) {
      const deltaIdle = idle - prevCpuTimes.idle;
      const deltaTotal = total - prevCpuTimes.total;
      if (deltaTotal > 0) {
        usage = 100 * (1 - deltaIdle / deltaTotal);
      }
    }
    prevCpuTimes = { idle, total };
    return Math.max(0, Math.min(100, Math.round(usage * 10) / 10));
  } catch (e) {
    return 0.0;
  }
}

function getTopProcesses() {
  const now = Date.now();
  const dt = Math.max(0.2, (now - prevProcTime) / 1000);
  const nextMap = new Map();
  const results = [];

  try {
    if (!fs.existsSync('/proc')) return [];
    const entries = fs.readdirSync('/proc');
    for (const entry of entries) {
      if (!/^\d+$/.test(entry)) continue;
      try {
        const statStr = fs.readFileSync(`/proc/${entry}/stat`, 'utf8');
        const openParen = statStr.indexOf('(');
        const closeParen = statStr.lastIndexOf(')');
        if (openParen === -1 || closeParen === -1) continue;

        const name = statStr.slice(openParen + 1, closeParen);
        const fields = statStr.slice(closeParen + 2).split(' ');
        const utime = Number(fields[11]) || 0;
        const stime = Number(fields[12]) || 0;
        const totalTicks = utime + stime;
        const rss = (Number(fields[21]) || 0) * 4096;

        nextMap.set(entry, totalTicks);
        const prevTicks = prevProcMap.get(entry);
        let cpuPct = 0;
        if (prevTicks != null && dt > 0) {
          cpuPct = Math.round(((totalTicks - prevTicks) / dt) * 10) / 10;
        }

        results.push({
          pid: Number(entry),
          name,
          cpu: Math.max(0, cpuPct),
          mem: Math.max(0, rss)
        });
      } catch (e) {}
    }
    prevProcMap = nextMap;
    prevProcTime = now;

    return results
      .sort((a, b) => b.cpu - a.cpu || b.mem - a.mem)
      .slice(0, 8);
  } catch (e) {
    return [];
  }
}

function getBatteryInfo() {
  const pwrDir = '/sys/class/power_supply';
  try {
    if (!fs.existsSync(pwrDir)) return null;
    const entries = fs.readdirSync(pwrDir);
    let bestBat = null;
    for (const ent of entries) {
      const entPath = path.join(pwrDir, ent);
      try {
        let type = '';
        const typeFile = path.join(entPath, 'type');
        if (fs.existsSync(typeFile)) {
          type = fs.readFileSync(typeFile, 'utf8').trim();
        }
        if (type.toLowerCase() === 'battery' || ent.startsWith('BAT')) {
          const capFile = path.join(entPath, 'capacity');
          const statFile = path.join(entPath, 'status');
          if (fs.existsSync(capFile)) {
            const capacity = parseInt(fs.readFileSync(capFile, 'utf8').trim(), 10);
            const status = fs.existsSync(statFile) ? fs.readFileSync(statFile, 'utf8').trim() : 'Unknown';
            if (!isNaN(capacity)) {
              bestBat = { capacity, status };
              break;
            }
          }
        }
      } catch (e) {}
    }
    return bestBat;
  } catch (e) {
    return null;
  }
}

function getSystemInfo() {
  let memTotal = os.totalmem();
  let memAvail = os.freemem();
  try {
    if (fs.existsSync('/proc/meminfo')) {
      const lines = fs.readFileSync('/proc/meminfo', 'utf8').split('\n');
      for (const line of lines) {
        const match = /^(\w+):\s+(\d+)\s+kB/.exec(line);
        if (match) {
          const bytes = Number(match[2]) * 1024;
          if (match[1] === 'MemTotal') memTotal = bytes;
          if (match[1] === 'MemAvailable') memAvail = bytes;
        }
      }
    }
  } catch (e) {}

  let disk = { total: 0, free: 0 };
  try {
    const statPath = process.platform === 'win32' ? RH : '/';
    if (typeof fs.statfsSync === 'function') {
      const s = fs.statfsSync(statPath);
      disk = {
        total: (s.blocks || 0) * (s.bsize || 0),
        free: (s.bavail || 0) * (s.bsize || 0)
      };
    }
  } catch (e) {}

  let networkOnline = false;
  try {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (!iface.internal && iface.family === 'IPv4') {
          networkOnline = true;
          break;
        }
      }
      if (networkOnline) break;
    }
  } catch (e) {}

  return {
    cpu: getCpuUsage(),
    cores: os.cpus() ? os.cpus().length : 1,
    mem: { total: memTotal, avail: memAvail },
    disk,
    uptime: os.uptime(),
    kernel: os.release(),
    hostname: os.hostname(),
    battery: getBatteryInfo(),
    network: { online: networkOnline },
    procs: getTopProcesses()
  };
}

module.exports = {
  getCpuUsage,
  getTopProcesses,
  getBatteryInfo,
  getSystemInfo
};

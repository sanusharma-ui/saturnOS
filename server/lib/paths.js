'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE_DIR = process.env.SATURN_HOME || (process.platform === 'linux' ? '/home/sanu' : os.homedir());
let RH = path.resolve(BASE_DIR);
try {
  if (fs.existsSync(RH)) {
    RH = fs.realpathSync(RH);
  } else {
    fs.mkdirSync(RH, { recursive: true });
    RH = fs.realpathSync(RH);
  }
} catch (e) {
  RH = path.resolve(BASE_DIR);
}

const TRASH_DIR = path.join(RH, '.saturn-trash');
const DESKTOP_DIR = path.join(RH, 'Desktop');

for (const dir of [TRASH_DIR, DESKTOP_DIR]) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) {}
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isInsideBase(targetPath) {
  const rel = path.relative(RH, targetPath);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function resolveSafePath(userPath, mustExist = true) {
  if (typeof userPath !== 'string' || !userPath || userPath.length > 4096 || userPath.includes('\0')) {
    throw new ApiError(400, 'Invalid path');
  }

  let cleaned = userPath.trim();
  if (cleaned.startsWith('~')) {
    cleaned = path.join(RH, cleaned.replace(/^~[\\\/]*/, ''));
  } else if (cleaned.startsWith('/home/sanu')) {
    cleaned = path.join(RH, cleaned.replace(/^\/home\/sanu[\\\/]*/, ''));
  }

  const resolved = path.resolve(RH, cleaned);
  if (!isInsideBase(resolved)) {
    throw new ApiError(403, 'Path outside allowed directory');
  }

  let finalPath = resolved;
  if (mustExist) {
    try {
      finalPath = fs.realpathSync(resolved);
    } catch (e) {
      throw new ApiError(404, 'File or folder not found');
    }
  } else {
    try {
      const parentDir = fs.realpathSync(path.dirname(resolved));
      finalPath = path.join(parentDir, path.basename(resolved));
    } catch (e) {
      throw new ApiError(404, 'Parent folder not found');
    }
  }

  if (!isInsideBase(finalPath)) {
    throw new ApiError(403, 'Path outside allowed directory');
  }

  return finalPath;
}

function sanitizeName(name) {
  if (typeof name !== 'string' || !name || name.length > 255) {
    throw new ApiError(400, 'Invalid filename length');
  }
  if (name.includes('/') || name.includes('\\') || name.includes('\0') || name === '.' || name === '..') {
    throw new ApiError(400, 'Invalid filename characters');
  }
  return name.trim();
}

function getUniquePath(dir, filename) {
  let target = path.join(dir, filename);
  if (!fs.existsSync(target)) return target;

  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let counter = 1;
  while (fs.existsSync(target)) {
    target = path.join(dir, `${base} (${counter++})${ext}`);
  }
  return target;
}

function moveFileOrFolder(src, dest) {
  try {
    fs.renameSync(src, dest);
  } catch (e) {
    fs.cpSync(src, dest, { recursive: true });
    fs.rmSync(src, { recursive: true, force: true });
  }
}

module.exports = {
  RH,
  BASE_DIR,
  TRASH_DIR,
  DESKTOP_DIR,
  ApiError,
  isInsideBase,
  resolveSafePath,
  sanitizeName,
  getUniquePath,
  moveFileOrFolder
};

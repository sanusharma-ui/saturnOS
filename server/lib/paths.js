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
const DOCUMENTS_DIR = path.join(RH, 'Documents');
const DOWNLOADS_DIR = path.join(RH, 'Downloads');
const PICTURES_DIR = path.join(RH, 'Pictures');
const MUSIC_DIR = path.join(RH, 'Music');
const VIDEOS_DIR = path.join(RH, 'Videos');

// Ensure all standard user folders exist
for (const dir of [TRASH_DIR, DESKTOP_DIR, DOCUMENTS_DIR, DOWNLOADS_DIR, PICTURES_DIR, MUSIC_DIR, VIDEOS_DIR]) {
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
  const normBase = path.resolve(RH);
  const normTarget = path.resolve(targetPath);
  if (process.platform === 'win32') {
    const rel = path.relative(normBase.toLowerCase(), normTarget.toLowerCase());
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  }
  const rel = path.relative(normBase, normTarget);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function resolveSafePath(userPath, mustExist = true) {
  if (userPath === undefined || userPath === null) {
    return RH;
  }
  if (typeof userPath !== 'string' || userPath.length > 4096 || userPath.includes('\0')) {
    throw new ApiError(400, 'Invalid path');
  }

  let cleaned = userPath.trim();
  if (cleaned === '' || cleaned === '.' || cleaned === '~' || cleaned === '/' || cleaned === '\\') {
    return RH;
  }

  // Handle ~ prefix
  if (cleaned.startsWith('~')) {
    cleaned = cleaned.replace(/^~[\\\/]*/, '');
  } else if (cleaned.startsWith('/home/sanu')) {
    cleaned = cleaned.replace(/^\/home\/sanu[\\\/]*/, '');
  } else if (/^[\\\/](?![a-zA-Z]:)/.test(cleaned)) {
    // Leading slash, but not Windows drive root like /C:/
    cleaned = cleaned.replace(/^[\\\/]+/, '');
  }

  let resolved;
  if (path.isAbsolute(cleaned)) {
    resolved = path.normalize(cleaned);
  } else {
    resolved = path.resolve(RH, cleaned);
  }

  if (!isInsideBase(resolved)) {
    // If path is outside base, throw 403
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
      // Parent might not exist yet, but is inside base
      finalPath = resolved;
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
  let counter = 2;
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

// Trash metadata manager
const TRASH_META_FILE = path.join(TRASH_DIR, '.metadata.json');

function getTrashMetadata() {
  try {
    if (fs.existsSync(TRASH_META_FILE)) {
      return JSON.parse(fs.readFileSync(TRASH_META_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveTrashMetadata(meta) {
  try {
    fs.writeFileSync(TRASH_META_FILE, JSON.stringify(meta, null, 2), 'utf8');
  } catch (e) {}
}

function recordTrashItem(trashFileName, originalPath) {
  const meta = getTrashMetadata();
  meta[trashFileName] = {
    originalPath,
    deletedAt: Date.now()
  };
  saveTrashMetadata(meta);
}

function removeTrashItemMeta(trashFileName) {
  const meta = getTrashMetadata();
  if (meta[trashFileName]) {
    delete meta[trashFileName];
    saveTrashMetadata(meta);
  }
}

module.exports = {
  RH,
  BASE_DIR,
  TRASH_DIR,
  DESKTOP_DIR,
  DOCUMENTS_DIR,
  DOWNLOADS_DIR,
  PICTURES_DIR,
  MUSIC_DIR,
  VIDEOS_DIR,
  ApiError,
  isInsideBase,
  resolveSafePath,
  sanitizeName,
  getUniquePath,
  moveFileOrFolder,
  getTrashMetadata,
  saveTrashMetadata,
  recordTrashItem,
  removeTrashItemMeta
};

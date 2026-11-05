'use strict';

const fs = require('fs');
const path = require('path');
const {
  RH,
  TRASH_DIR,
  DESKTOP_DIR,
  ApiError,
  resolveSafePath,
  sanitizeName,
  getUniquePath,
  moveFileOrFolder
} = require('../lib/paths');

function searchFiles(query, rootDir) {
  const q = query.toLowerCase();
  const results = [];
  const queue = [[rootDir, 0]];
  let scannedCount = 0;
  const startTime = Date.now();

  while (queue.length > 0 && results.length < 50 && scannedCount < 10000) {
    if (Date.now() - startTime > 350) break;
    const [currentDir, depth] = queue.shift();

    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (e) {
      continue;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      scannedCount++;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.name.toLowerCase().includes(q)) {
        results.push({
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'dir' : 'file'
        });
        if (results.length >= 50) break;
      }

      if (entry.isDirectory() && depth < 4) {
        queue.push([fullPath, depth + 1]);
      }
    }
  }

  return results;
}

function handleFsGet(pathname, query) {
  if (pathname === '/api/fs/list') {
    const targetDir = resolveSafePath(query.get('path') || RH);
    const stat = fs.statSync(targetDir);
    if (!stat.isDirectory()) throw new ApiError(400, 'Target is not a directory');

    const items = [];
    const entries = fs.readdirSync(targetDir).slice(0, 2000);
    for (const name of entries) {
      try {
        const itemPath = path.join(targetDir, name);
        const itemStat = fs.statSync(itemPath);
        items.push({
          name,
          type: itemStat.isDirectory() ? 'dir' : 'file',
          size: itemStat.size,
          mtime: itemStat.mtimeMs
        });
      } catch (e) {}
    }

    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return { path: targetDir, items };
  }

  if (pathname === '/api/fs/read') {
    const targetFile = resolveSafePath(query.get('path') || '');
    const stat = fs.statSync(targetFile);
    if (!stat.isFile()) throw new ApiError(400, 'Target is not a file');
    if (stat.size > 5 * 1024 * 1024) throw new ApiError(413, 'File exceeds 5MB limit');

    const content = fs.readFileSync(targetFile, 'utf8');
    return { path: targetFile, content };
  }

  if (pathname === '/api/fs/search') {
    const q = String(query.get('q') || '').trim();
    if (!q || q.length > 100) throw new ApiError(400, 'Search query must be 1-100 characters');
    const startDir = resolveSafePath(query.get('path') || RH);
    return { results: searchFiles(q, startDir) };
  }

  throw new ApiError(404, 'Unknown FS GET endpoint');
}

function handleFsPost(pathname, body) {
  if (pathname === '/api/fs/write') {
    if (typeof body.content !== 'string' || body.content.length > 5 * 1024 * 1024) {
      throw new ApiError(400, 'Invalid file content (max 5MB string)');
    }
    const targetPath = resolveSafePath(body.path, false);
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      throw new ApiError(400, 'Target path is a directory');
    }
    fs.writeFileSync(targetPath, body.content, 'utf8');
    return { ok: true, path: targetPath };
  }

  if (pathname === '/api/fs/mkdir') {
    let parentDir;
    let folderName;

    if (body.name && typeof body.name === 'string' && body.name.trim()) {
      const rawTarget = body.path || RH;
      try {
        parentDir = resolveSafePath(rawTarget, true);
      } catch (e) {
        parentDir = resolveSafePath(rawTarget, false);
        fs.mkdirSync(parentDir, { recursive: true });
      }
      folderName = sanitizeName(body.name);
    } else if (body.path && typeof body.path === 'string') {
      const rawPath = body.path.trim();
      const baseName = path.basename(rawPath);
      const dirPart = path.dirname(rawPath);
      const rawTarget = dirPart === '.' ? RH : dirPart;
      try {
        parentDir = resolveSafePath(rawTarget, true);
      } catch (e) {
        parentDir = resolveSafePath(rawTarget, false);
        fs.mkdirSync(parentDir, { recursive: true });
      }
      folderName = sanitizeName(baseName);
    } else {
      throw new ApiError(400, 'Folder path or name is required');
    }

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    const stat = fs.statSync(parentDir);
    if (!stat.isDirectory()) throw new ApiError(400, 'Parent is not a directory');

    const finalPath = getUniquePath(parentDir, folderName);
    fs.mkdirSync(finalPath, { recursive: true });
    return { ok: true, path: finalPath, name: path.basename(finalPath) };
  }

  if (pathname === '/api/fs/rename') {
    const sourcePath = resolveSafePath(body.path, true);
    if (sourcePath === RH) throw new ApiError(403, 'Cannot rename root home directory');
    const newName = sanitizeName(body.name);
    const destPath = path.join(path.dirname(sourcePath), newName);
    if (fs.existsSync(destPath)) throw new ApiError(409, 'Name already in use');
    fs.renameSync(sourcePath, destPath);
    return { ok: true, path: destPath };
  }

  if (pathname === '/api/fs/delete') {
    if (body.emptyTrash === true) {
      if (fs.existsSync(TRASH_DIR)) {
        for (const item of fs.readdirSync(TRASH_DIR)) {
          fs.rmSync(path.join(TRASH_DIR, item), { recursive: true, force: true });
        }
      }
      return { ok: true, emptied: true };
    }

    const sourcePath = resolveSafePath(body.path, true);
    if (sourcePath === RH || sourcePath === TRASH_DIR) {
      throw new ApiError(403, 'Cannot delete protected system directory');
    }
    if (path.dirname(sourcePath) === RH && path.basename(sourcePath) === 'Desktop') {
      throw new ApiError(403, 'Cannot delete Desktop folder');
    }

    if (sourcePath.startsWith(TRASH_DIR + path.sep)) {
      fs.rmSync(sourcePath, { recursive: true, force: true });
    } else {
      const dest = getUniquePath(TRASH_DIR, path.basename(sourcePath));
      moveFileOrFolder(sourcePath, dest);
    }
    return { ok: true };
  }

  if (pathname === '/api/fs/copy' || pathname === '/api/fs/move') {
    const src = resolveSafePath(body.src, true);
    const dest = resolveSafePath(body.dest, true);
    const stat = fs.statSync(dest);
    if (!stat.isDirectory()) throw new ApiError(400, 'Destination is not a directory');

    if (src === RH) throw new ApiError(403, 'Cannot copy/move root directory');
    if (dest === src || dest.startsWith(src + path.sep)) {
      throw new ApiError(400, 'Cannot place a folder inside itself');
    }

    if (pathname === '/api/fs/move' && path.dirname(src) === dest) {
      return { ok: true, noop: true };
    }

    const target = getUniquePath(dest, path.basename(src));
    if (pathname === '/api/fs/copy') {
      fs.cpSync(src, target, { recursive: true });
    } else {
      moveFileOrFolder(src, target);
    }
    return { ok: true, path: target };
  }

  throw new ApiError(404, 'Unknown FS POST endpoint');
}

module.exports = {
  handleFsGet,
  handleFsPost
};

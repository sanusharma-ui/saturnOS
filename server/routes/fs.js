'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  RH,
  TRASH_DIR,
  DESKTOP_DIR,
  DOCUMENTS_DIR,
  DOWNLOADS_DIR,
  PICTURES_DIR,
  MUSIC_DIR,
  VIDEOS_DIR,
  ApiError,
  resolveSafePath,
  sanitizeName,
  getUniquePath,
  moveFileOrFolder,
  getTrashMetadata,
  saveTrashMetadata,
  recordTrashItem,
  removeTrashItemMeta
} = require('../lib/paths');

function searchFiles(query, rootDir) {
  const q = query.toLowerCase();
  const results = [];
  const queue = [[rootDir, 0]];
  let scannedCount = 0;
  const startTime = Date.now();

  while (queue.length > 0 && results.length < 60 && scannedCount < 10000) {
    if (Date.now() - startTime > 400) break;
    const [currentDir, depth] = queue.shift();

    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (e) {
      continue;
    }

    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.saturn-trash') continue;
      scannedCount++;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.name.toLowerCase().includes(q)) {
        results.push({
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'dir' : 'file',
          isDir: entry.isDirectory()
        });
        if (results.length >= 60) break;
      }

      if (entry.isDirectory() && depth < 5) {
        queue.push([fullPath, depth + 1]);
      }
    }
  }

  return results;
}

function handleFsGet(pathname, query) {
  if (pathname === '/api/fs/info') {
    let username = 'sanu';
    try {
      const u = os.userInfo();
      if (u && u.username) username = u.username;
    } catch (e) {}

    return {
      home: RH,
      desktop: DESKTOP_DIR,
      documents: DOCUMENTS_DIR,
      downloads: DOWNLOADS_DIR,
      pictures: PICTURES_DIR,
      music: MUSIC_DIR,
      videos: VIDEOS_DIR,
      trash: TRASH_DIR,
      platform: process.platform,
      sep: path.sep,
      username
    };
  }

  if (pathname === '/api/fs/list') {
    const rawPath = query.get('path');
    const targetDir = resolveSafePath(rawPath || RH);
    const stat = fs.statSync(targetDir);
    if (!stat.isDirectory()) throw new ApiError(400, 'Target is not a directory');

    const showHidden = query.get('hidden') === '1' || query.get('hidden') === 'true';
    const isTrash = targetDir === TRASH_DIR;
    const trashMeta = isTrash ? getTrashMetadata() : null;

    const items = [];
    const entries = fs.readdirSync(targetDir).slice(0, 3000);
    for (const name of entries) {
      // Don't show internal trash metadata file
      if (isTrash && name === '.metadata.json') continue;
      // Filter out internal hidden files if hidden is off, but allow .saturn-trash check
      const isHidden = name.startsWith('.');
      if (!showHidden && isHidden && !isTrash) {
        if (name === '.saturn-trash') continue;
      }

      try {
        const itemPath = path.join(targetDir, name);
        const itemStat = fs.statSync(itemPath);
        const isDir = itemStat.isDirectory();
        const ext = isDir ? '' : path.extname(name).replace(/^\./, '').toLowerCase();

        const itemObj = {
          name,
          path: itemPath,
          type: isDir ? 'dir' : 'file',
          isDir,
          size: itemStat.size,
          mtime: itemStat.mtimeMs,
          ext,
          hidden: isHidden
        };

        if (isTrash && trashMeta && trashMeta[name]) {
          itemObj.originalPath = trashMeta[name].originalPath;
          itemObj.deletedAt = trashMeta[name].deletedAt;
        }

        items.push(itemObj);
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
    if (stat.size > 10 * 1024 * 1024) throw new ApiError(413, 'File exceeds 10MB limit');

    const content = fs.readFileSync(targetFile, 'utf8');
    return { path: targetFile, content, size: stat.size, mtime: stat.mtimeMs };
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
  // 1. Create File or Directory (Real PC creation)
  if (pathname === '/api/fs/create') {
    const targetDir = resolveSafePath(body.dir || RH, true);
    const dirStat = fs.statSync(targetDir);
    if (!dirStat.isDirectory()) throw new ApiError(400, 'Target location is not a directory');

    const itemType = body.type === 'dir' ? 'dir' : 'file';
    let defaultName = itemType === 'dir' ? 'New Folder' : 'New Text Document.txt';
    if (body.name && typeof body.name === 'string' && body.name.trim()) {
      defaultName = sanitizeName(body.name);
    }

    const finalPath = getUniquePath(targetDir, defaultName);
    const finalName = path.basename(finalPath);

    if (itemType === 'dir') {
      fs.mkdirSync(finalPath, { recursive: true });
    } else {
      const initialContent = typeof body.content === 'string' ? body.content : '';
      fs.writeFileSync(finalPath, initialContent, 'utf8');
    }

    const stat = fs.statSync(finalPath);
    return {
      ok: true,
      path: finalPath,
      name: finalName,
      type: itemType,
      isDir: itemType === 'dir',
      size: stat.size,
      mtime: stat.mtimeMs
    };
  }

  // 2. Duplicate File or Directory
  if (pathname === '/api/fs/duplicate') {
    const srcPath = resolveSafePath(body.path, true);
    if (srcPath === RH) throw new ApiError(403, 'Cannot duplicate root directory');

    const parentDir = path.dirname(srcPath);
    const ext = path.extname(srcPath);
    const base = path.basename(srcPath, ext);
    const copyName = `${base} - Copy${ext}`;
    const targetPath = getUniquePath(parentDir, copyName);

    fs.cpSync(srcPath, targetPath, { recursive: true });
    const stat = fs.statSync(targetPath);
    return {
      ok: true,
      path: targetPath,
      name: path.basename(targetPath),
      type: stat.isDirectory() ? 'dir' : 'file',
      size: stat.size
    };
  }

  // 3. Restore from Trash
  if (pathname === '/api/fs/restore') {
    const trashItem = resolveSafePath(body.path, true);
    if (!trashItem.startsWith(TRASH_DIR + path.sep)) {
      throw new ApiError(400, 'Item is not in Trash');
    }

    const itemName = path.basename(trashItem);
    const meta = getTrashMetadata();
    const itemMeta = meta[itemName];
    let destPath;

    if (itemMeta && itemMeta.originalPath) {
      const origDir = path.dirname(itemMeta.originalPath);
      try {
        if (!fs.existsSync(origDir)) fs.mkdirSync(origDir, { recursive: true });
      } catch (e) {}
      destPath = getUniquePath(origDir, path.basename(itemMeta.originalPath));
    } else {
      // Fallback to Desktop or Home
      destPath = getUniquePath(DESKTOP_DIR, itemName);
    }

    moveFileOrFolder(trashItem, destPath);
    removeTrashItemMeta(itemName);
    return { ok: true, path: destPath, name: path.basename(destPath) };
  }

  // 4. Write File
  if (pathname === '/api/fs/write') {
    if (typeof body.content !== 'string' || body.content.length > 10 * 1024 * 1024) {
      throw new ApiError(400, 'Invalid file content (max 10MB string)');
    }
    const targetPath = resolveSafePath(body.path, false);
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      throw new ApiError(400, 'Target path is a directory');
    }
    fs.writeFileSync(targetPath, body.content, 'utf8');
    const stat = fs.statSync(targetPath);
    return { ok: true, path: targetPath, name: path.basename(targetPath), size: stat.size, mtime: stat.mtimeMs };
  }

  // 5. Make Directory (mkdir)
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
      parentDir = RH;
      folderName = 'New Folder';
    }

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    const stat = fs.statSync(parentDir);
    if (!stat.isDirectory()) throw new ApiError(400, 'Parent is not a directory');

    const finalPath = getUniquePath(parentDir, folderName);
    fs.mkdirSync(finalPath, { recursive: true });
    return { ok: true, path: finalPath, name: path.basename(finalPath), isDir: true };
  }

  // 6. Rename
  if (pathname === '/api/fs/rename') {
    const sourcePath = resolveSafePath(body.path, true);
    if (sourcePath === RH) throw new ApiError(403, 'Cannot rename root home directory');
    const newName = sanitizeName(body.name);
    const destPath = path.join(path.dirname(sourcePath), newName);
    if (fs.existsSync(destPath) && destPath.toLowerCase() !== sourcePath.toLowerCase()) {
      throw new ApiError(409, 'A file or folder with that name already exists');
    }
    fs.renameSync(sourcePath, destPath);
    return { ok: true, path: destPath, name: newName };
  }

  // 7. Delete (Move to Trash / Empty Trash)
  if (pathname === '/api/fs/delete') {
    if (body.emptyTrash === true) {
      if (fs.existsSync(TRASH_DIR)) {
        for (const item of fs.readdirSync(TRASH_DIR)) {
          try {
            fs.rmSync(path.join(TRASH_DIR, item), { recursive: true, force: true });
          } catch (e) {}
        }
      }
      saveTrashMetadata({});
      return { ok: true, emptied: true };
    }

    const sourcePath = resolveSafePath(body.path, true);
    if (sourcePath === RH || sourcePath === TRASH_DIR) {
      throw new ApiError(403, 'Cannot delete protected system directory');
    }
    if (path.dirname(sourcePath) === RH && path.basename(sourcePath) === 'Desktop') {
      throw new ApiError(403, 'Cannot delete Desktop folder');
    }

    // If permanent deletion requested or already in Trash
    if (body.permanent === true || sourcePath.startsWith(TRASH_DIR + path.sep)) {
      fs.rmSync(sourcePath, { recursive: true, force: true });
      removeTrashItemMeta(path.basename(sourcePath));
      return { ok: true, permanent: true };
    }

    // Move to Trash
    const trashTarget = getUniquePath(TRASH_DIR, path.basename(sourcePath));
    const trashFileName = path.basename(trashTarget);
    recordTrashItem(trashFileName, sourcePath);
    moveFileOrFolder(sourcePath, trashTarget);
    return { ok: true, trashed: true, trashPath: trashTarget };
  }

  // 8. Copy or Move
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
    return { ok: true, path: target, name: path.basename(target) };
  }

  throw new ApiError(404, 'Unknown FS POST endpoint');
}

module.exports = {
  handleFsGet,
  handleFsPost
};

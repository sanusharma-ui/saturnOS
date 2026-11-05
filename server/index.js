'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const { ApiError } = require('./lib/paths');
const { MIME_TYPES } = require('./lib/mime');
const { handleFsGet, handleFsPost } = require('./routes/fs');
const { handleSysinfoGet } = require('./routes/sysinfo');
const { handlePowerPost } = require('./routes/power');
const { handleLaunchPost } = require('./routes/launch');
const { handleFileGet } = require('./routes/file');
const { handleLlmHealth, handleLlmChat } = require('./routes/llm');

const PORT = 3000;
const HOST = '127.0.0.1';

// Static assets directory: prefer dist/ (built app), fallback to public/
const ROOT_DIR = path.join(__dirname, '..');
function getStaticDir() {
  const distPath = path.join(ROOT_DIR, 'dist');
  if (fs.existsSync(distPath)) return distPath;
  return path.join(ROOT_DIR, 'public');
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store, no-cache, must-revalidate'
  });
  res.end(body);
}

function readBody(req, maxSize = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxSize) {
        req.destroy();
        reject(new ApiError(413, 'Payload too large'));
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        const str = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(str));
      } catch (e) {
        reject(new ApiError(400, 'Malformed JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveStaticFile(req, res, parsedUrl) {
  const staticDir = getStaticDir();
  let relativePath = '';
  try {
    relativePath = decodeURIComponent(parsedUrl.pathname);
  } catch (e) {
    throw new ApiError(400, 'Bad URL encoding');
  }

  if (relativePath === '/' || relativePath === '') {
    relativePath = '/index.html';
  }

  const normalized = path.normalize(relativePath);
  let filePath = path.join(staticDir, normalized);

  // If file doesn't exist in dist, also check public/ (e.g. saturnOS.png or wallpaper.jpg)
  if (!fs.existsSync(filePath)) {
    const pubFallback = path.join(ROOT_DIR, 'public', normalized);
    if (fs.existsSync(pubFallback)) {
      filePath = pubFallback;
    } else {
      throw new ApiError(404, 'Static file not found');
    }
  }

  try {
    filePath = fs.realpathSync(filePath);
  } catch (e) {
    throw new ApiError(404, 'Static file not found');
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new ApiError(404, 'Not a static file');

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const isHtml = ext === '.html';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': isHtml ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600'
  });

  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    if (pathname.startsWith('/api/')) {
      if (method === 'GET') {
        if (pathname === '/api/sysinfo') {
          return sendJson(res, 200, handleSysinfoGet());
        }
        if (pathname === '/api/file') {
          return handleFileGet(req, res, parsedUrl.searchParams);
        }
        if (pathname.startsWith('/api/fs/')) {
          return sendJson(res, 200, handleFsGet(pathname, parsedUrl.searchParams));
        }
        if (pathname === '/api/llm/health') {
          return await handleLlmHealth(res);
        }
        throw new ApiError(404, 'Unknown API GET endpoint');
      }

      if (method === 'POST') {
        if (pathname === '/api/llm/chat') {
          const body = await readBody(req, 2 * 1024 * 1024);
          return await handleLlmChat(req, res, body);
        }

        const body = await readBody(req);
        if (pathname === '/api/launch') {
          return sendJson(res, 200, handleLaunchPost(body));
        }
        if (pathname === '/api/power') {
          return sendJson(res, 200, handlePowerPost(body));
        }
        if (pathname.startsWith('/api/fs/')) {
          return sendJson(res, 200, handleFsPost(pathname, body));
        }
        throw new ApiError(404, 'Unknown API POST endpoint');
      }

      throw new ApiError(405, 'Method not allowed');
    }

    if (method === 'GET' || method === 'HEAD') {
      serveStaticFile(req, res, parsedUrl);
    } else {
      throw new ApiError(405, 'Method not allowed');
    }
  } catch (err) {
    const status = err instanceof ApiError ? err.status : (err && err.code === 'ENOENT' ? 404 : (err && err.code === 'EACCES' ? 403 : 500));
    const message = err instanceof ApiError ? err.message : (status === 500 ? 'Internal server error' : (err ? err.message : 'Unknown error'));
    if (!res.headersSent) {
      sendJson(res, status, { error: message });
    } else {
      res.end();
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Saturn shell on http://${HOST}:${PORT}`);
});

process.on('uncaughtException', err => {
  console.error('Server uncaughtException:', err && err.message ? err.message : err);
});

process.on('unhandledRejection', reason => {
  console.error('Server unhandledRejection:', reason);
});

module.exports = server;

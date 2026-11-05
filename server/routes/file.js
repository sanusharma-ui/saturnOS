'use strict';

const fs = require('fs');
const path = require('path');
const { ApiError, resolveSafePath } = require('../lib/paths');
const { MIME_TYPES } = require('../lib/mime');

function handleFileGet(req, res, query) {
  const filePath = resolveSafePath(query.get('path') || '');
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (e) {
    throw new ApiError(404, 'File not found');
  }

  if (!stat.isFile()) throw new ApiError(400, 'Not a regular file');

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const fileSize = stat.size;

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    let start = parseInt(parts[0], 10);
    let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start)) {
      start = fileSize - parseInt(parts[1], 10);
      end = fileSize - 1;
    }
    if (isNaN(end)) {
      end = fileSize - 1;
    }

    if (start >= fileSize || end >= fileSize || start > end || start < 0) {
      res.writeHead(416, {
        'Content-Range': `bytes */${fileSize}`,
        'Content-Type': contentType
      });
      return res.end();
    }

    const chunksize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600'
    });

    const fileStream = fs.createReadStream(filePath, { start, end });
    fileStream.on('error', () => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600'
    });
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', () => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    fileStream.pipe(res);
  }
}

module.exports = {
  handleFileGet
};

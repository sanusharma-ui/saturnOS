'use strict';

const http = require('http');
const { ApiError } = require('../lib/paths');

const LLM_HOST = '127.0.0.1';
const LLM_PORT = 8080;

function handleLlmHealth(res) {
  return new Promise(resolve => {
    const upReq = http.request(
      {
        host: LLM_HOST,
        port: LLM_PORT,
        path: '/health',
        method: 'GET',
        timeout: 2500
      },
      upRes => {
        let data = '';
        upRes.on('data', chunk => (data += chunk));
        upRes.on('end', () => {
          const body = JSON.stringify(
            upRes.statusCode === 200
              ? { status: 'ok' }
              : upRes.statusCode === 503
              ? { status: 'loading' }
              : { status: 'loading', detail: data }
          );
          res.writeHead(upRes.statusCode || 200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(body),
            'Cache-Control': 'no-store'
          });
          res.end(body);
          resolve();
        });
      }
    );

    upReq.on('timeout', () => {
      upReq.destroy();
      const body = JSON.stringify({ status: 'offline', error: 'LLM connection timeout' });
      res.writeHead(503, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store'
      });
      res.end(body);
      resolve();
    });

    upReq.on('error', err => {
      const body = JSON.stringify({ status: 'offline', error: err.message });
      res.writeHead(503, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store'
      });
      res.end(body);
      resolve();
    });

    upReq.end();
  });
}

function handleLlmChat(req, res, payload) {
  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    throw new ApiError(400, 'messages array required');
  }

  const forwardData = JSON.stringify({
    messages: payload.messages.slice(-40),
    stream: true,
    temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.4,
    max_tokens: typeof payload.max_tokens === 'number' ? payload.max_tokens : 1024
  });

  return new Promise(resolve => {
    const upReq = http.request(
      {
        host: LLM_HOST,
        port: LLM_PORT,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(forwardData)
        }
      },
      upRes => {
        res.writeHead(upRes.statusCode || 200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });
        upRes.pipe(res);
        upRes.on('end', resolve);
      }
    );

    upReq.on('error', err => {
      if (!res.headersSent) {
        const body = JSON.stringify({ error: 'Local model is not reachable on 127.0.0.1:8080: ' + err.message });
        res.writeHead(502, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body)
        });
        res.end(body);
      } else {
        res.end();
      }
      resolve();
    });

    res.on('close', () => {
      upReq.destroy();
      resolve();
    });

    upReq.end(forwardData);
  });
}

module.exports = {
  handleLlmHealth,
  handleLlmChat
};

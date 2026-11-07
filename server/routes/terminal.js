'use strict';

const crypto = require('crypto');
const { URL } = require('url');
const { terminalSessionManager } = require('../lib/terminalSession');
const { ApiError } = require('../lib/paths');

const WS_MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/**
 * Encodes text payload into an unmasked RFC 6455 WebSocket frame (Server -> Client)
 */
function encodeFrame(data) {
  const payload = Buffer.from(data, 'utf8');
  const length = payload.length;

  let header;
  if (length <= 125) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text opcode
    header[1] = length;
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payload]);
}

/**
 * Parses client RFC 6455 WebSocket frames (Client -> Server: masked)
 */
function parseFrames(buffer) {
  const messages = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const firstByte = buffer[offset];
    const opcode = firstByte & 0x0f;
    const secondByte = buffer[offset + 1];
    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLen = secondByte & 0x7f;

    let headerSize = 2;
    if (payloadLen === 126) {
      if (offset + 4 > buffer.length) break;
      payloadLen = buffer.readUInt16BE(offset + 2);
      headerSize = 4;
    } else if (payloadLen === 127) {
      if (offset + 10 > buffer.length) break;
      payloadLen = Number(buffer.readBigUInt64BE(offset + 2));
      headerSize = 10;
    }

    const maskSize = isMasked ? 4 : 0;
    const totalFrameSize = headerSize + maskSize + payloadLen;

    if (offset + totalFrameSize > buffer.length) {
      break; // Incomplete frame, wait for more data
    }

    let payload = buffer.subarray(offset + headerSize + maskSize, offset + totalFrameSize);

    if (isMasked) {
      const mask = buffer.subarray(offset + headerSize, offset + headerSize + 4);
      const unmasked = Buffer.alloc(payloadLen);
      for (let i = 0; i < payloadLen; i++) {
        unmasked[i] = payload[i] ^ mask[i % 4];
      }
      payload = unmasked;
    }

    messages.push({ opcode, data: payload.toString('utf8') });
    offset += totalFrameSize;
  }

  return { messages, remaining: buffer.subarray(offset) };
}

/**
 * Handles HTTP Upgrade for WebSocket requests on /api/terminal/ws
 */
function handleTerminalUpgrade(req, socket, head) {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    if (parsedUrl.pathname !== '/api/terminal/ws') {
      socket.destroy();
      return;
    }

    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    // RFC 6455 Handshake Response
    const acceptKey = crypto
      .createHash('sha1')
      .update(key + WS_MAGIC_STRING)
      .digest('base64');

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '\r\n'
    ];

    socket.write(responseHeaders.join('\r\n'));

    // Retrieve parameters
    const sessionId = parsedUrl.searchParams.get('id') || `term_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const requestedShell = parsedUrl.searchParams.get('shell') || '';
    const requestedCwd = parsedUrl.searchParams.get('cwd') || '';
    const cols = parseInt(parsedUrl.searchParams.get('cols') || '80', 10);
    const rows = parseInt(parsedUrl.searchParams.get('rows') || '24', 10);

    const sendMsg = obj => {
      try {
        if (!socket.destroyed) {
          socket.write(encodeFrame(JSON.stringify(obj)));
        }
      } catch (e) {}
    };

    let session = terminalSessionManager.get(sessionId);
    if (!session || !session.active) {
      session = terminalSessionManager.create(
        sessionId,
        output => {
          sendMsg({ type: 'output', data: output });
        },
        (code, signal) => {
          sendMsg({ type: 'exit', code, signal });
        },
        { shell: requestedShell, cwd: requestedCwd, cols, rows }
      );
    } else {
      // Re-attach listeners to existing active session
      session.onOutput = output => {
        sendMsg({ type: 'output', data: output });
      };
      session.onExit = (code, signal) => {
        sendMsg({ type: 'exit', code, signal });
      };
    }

    // Send ready event
    sendMsg({
      type: 'ready',
      sessionId: session.id,
      shell: session.shell,
      cwd: session.cwd,
      pid: session.process ? session.process.pid : 0
    });

    let buffer = Buffer.alloc(0);

    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      const { messages, remaining } = parseFrames(buffer);
      buffer = remaining;

      for (const msg of messages) {
        if (msg.opcode === 0x8) {
          // Close frame
          socket.end();
          return;
        }
        if (msg.opcode === 0x9) {
          // Ping frame -> reply pong
          sendMsg({ type: 'pong' });
          continue;
        }
        if (msg.opcode === 0x1) {
          // Text message
          try {
            const clientMsg = JSON.parse(msg.data);
            if (clientMsg.type === 'input') {
              session.write(clientMsg.data);
            } else if (clientMsg.type === 'resize') {
              session.resize(clientMsg.cols || 80, clientMsg.rows || 24);
            } else if (clientMsg.type === 'signal') {
              session.kill(clientMsg.signal);
            } else if (clientMsg.type === 'ping') {
              sendMsg({ type: 'pong' });
            }
          } catch (e) {
            // Raw text input fallback
            session.write(msg.data);
          }
        }
      }
    });

    socket.on('close', () => {
      // Keep session alive for reconnection unless explicitly killed
    });

    socket.on('error', () => {
      socket.destroy();
    });
  } catch (err) {
    socket.destroy();
  }
}

/**
 * REST handlers for terminal session management
 */
function handleTerminalSessionsGet() {
  const list = [];
  for (const session of terminalSessionManager.sessions.values()) {
    list.push(session.getInfo());
  }
  return { ok: true, sessions: list };
}

function handleTerminalKillPost(body) {
  const { sessionId, signal } = body;
  if (!sessionId) {
    throw new ApiError(400, 'sessionId is required');
  }
  const destroyed = terminalSessionManager.destroy(sessionId);
  return { ok: destroyed, sessionId };
}

module.exports = {
  handleTerminalUpgrade,
  handleTerminalSessionsGet,
  handleTerminalKillPost
};

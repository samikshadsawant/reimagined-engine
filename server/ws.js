/**
 * WebSocket Server for SavitaOS Real-time Events
 *
 * Handles:
 *   - Filesystem change notifications (chokidar)
 *   - Agent status broadcasts
 *   - Gemini Live voice sessions (Phase 2)
 */

const WebSocket = require('ws')
const chokidar = require('chokidar')
const geminiVoice = require('./lib/geminiVoice')
const { config: gnaniConfig, apiUrl: gnaniApiUrl, getLanguageChoice } = require('./lib/gnani/config')

// Store active connections
const clients = new Set()
// session-id → WebSocket mapping for targeted messaging (H1 fix)
const sessionClients = new Map()

let watcher = null
let heartbeatInterval = null
let wssInstance = null
let gnaniWssInstance = null
const gnaniHandshakeCounts = new Map()
const GNANI_HANDSHAKE_WINDOW_MS = 60 * 1000
const GNANI_HANDSHAKE_LIMIT = 12
const GNANI_FRAME_BYTES = gnaniConfig.stt.frameSamples * 2

function resolveWatchRoot() {
  const path = require('path')
  const fs = require('fs')
  const candidates = [process.env.FS_ROOT, process.env.DEMO_FS_ROOT, './demo-filesystem']

  for (const candidate of candidates) {
    if (!candidate) continue

    const resolved = path.isAbsolute(candidate)
      ? path.resolve(candidate)
      : path.resolve(__dirname, '../../', candidate)

    if (fs.existsSync(resolved)) {
      return resolved
    }
  }

  return path.resolve(__dirname, '../../demo-filesystem')
}

/**
 * Initialize WebSocket server
 * @param {Object} httpServer - HTTP server instance
 */
function initWS(httpServer) {
  const wss = new WebSocket.Server({ noServer: true })
  const gnaniWss = new WebSocket.Server({ noServer: true, maxPayload: GNANI_FRAME_BYTES + 1024 })
  wssInstance = wss
  gnaniWssInstance = gnaniWss

  httpServer.on('upgrade', (request, socket, head) => {
    const requestPath = new URL(request.url, 'http://localhost').pathname
    if (requestPath !== '/ws/gnani/stt') {
      wss.handleUpgrade(request, socket, head, (client) => {
        wss.emit('connection', client, request)
      })
      return
    }

    if (!gnaniConfig.apiKey) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }

    const requestOrigin = request.headers.origin
    if (requestOrigin) {
      const allowedOrigin = new URL(process.env.CLIENT_URL || 'http://localhost:5173').origin
      if (requestOrigin !== allowedOrigin) {
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
    }

    const now = Date.now()
    for (const [ip, entry] of gnaniHandshakeCounts) {
      if (now - entry.startedAt >= GNANI_HANDSHAKE_WINDOW_MS) gnaniHandshakeCounts.delete(ip)
    }
    const ip = request.socket.remoteAddress || 'unknown'
    const attempts = gnaniHandshakeCounts.get(ip)
    if (attempts && now - attempts.startedAt < GNANI_HANDSHAKE_WINDOW_MS && attempts.count >= GNANI_HANDSHAKE_LIMIT) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    gnaniHandshakeCounts.set(ip, {
      startedAt: attempts && now - attempts.startedAt < GNANI_HANDSHAKE_WINDOW_MS ? attempts.startedAt : now,
      count: attempts && now - attempts.startedAt < GNANI_HANDSHAKE_WINDOW_MS ? attempts.count + 1 : 1
    })

    gnaniWss.handleUpgrade(request, socket, head, (client) => {
      gnaniWss.emit('connection', client, request)
    })
  })

  gnaniWss.on('connection', (client) => {
    let upstream = null
    let started = false
    let closed = false
    const sessionTimeout = setTimeout(() => {
      fail('Timed out waiting for voice session settings.', 'SESSION_TIMEOUT')
    }, gnaniConfig.requestTimeoutMs)

    const send = (message) => {
      if (!closed && client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message))
    }
    const fail = (message, code = 'GNANI_STT_ERROR') => {
      clearTimeout(sessionTimeout)
      send({ type: 'error', code, message })
      closed = true
      if (upstream && upstream.readyState === WebSocket.OPEN) upstream.close(1011, 'STT session ended')
      if (client.readyState === WebSocket.OPEN) client.close(1011, 'STT session ended')
    }
    const closeUpstream = () => {
      if (upstream && upstream.readyState < WebSocket.CLOSING) upstream.close(1000, 'Client disconnected')
    }

    const startUpstream = (message) => {
      if (started) return fail('STT session has already started.', 'INVALID_SESSION')
      const languageChoice = message && getLanguageChoice(message.language)
      if (!message || message.type !== 'start' || !languageChoice) {
        return fail('Choose a supported STT language to start voice input.', 'INVALID_LANGUAGE')
      }
      started = true
      clearTimeout(sessionTimeout)

      const upstreamUrl = gnaniApiUrl(gnaniConfig.stt.websocketPath).href.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
      upstream = new WebSocket(upstreamUrl, {
        headers: {
          'X-API-Key-ID': gnaniConfig.apiKey,
          lang_code: languageChoice.sttCode,
          'x-sample-rate': String(gnaniConfig.stt.sampleRate),
          'x-format': gnaniConfig.stt.format,
          'x-vad-threshold': String(gnaniConfig.stt.vadThreshold),
          'x-min-silence-ms': String(gnaniConfig.stt.minSilenceMs)
        },
        handshakeTimeout: gnaniConfig.requestTimeoutMs,
        maxPayload: GNANI_FRAME_BYTES + 1024
      })

      upstream.on('open', () => {
        send({ type: 'connected', provider: 'Gnani Prisma', model: gnaniConfig.stt.model })
      })
      upstream.on('message', (raw, isBinary) => {
        if (isBinary) return fail('Gnani sent an unsupported STT response.', 'INVALID_UPSTREAM_RESPONSE')
        let event
        try {
          event = JSON.parse(raw.toString())
        } catch {
          return fail('Gnani sent an invalid STT response.', 'INVALID_UPSTREAM_RESPONSE')
        }
        if (event.type === 'processing') {
          send({ type: 'processing' })
        } else if (event.type === 'transcript' && typeof event.text === 'string') {
          send({ type: 'transcript', text: event.text.slice(0, 4000) })
        } else if (event.type === 'error') {
          fail('Gnani could not transcribe this audio.', 'GNANI_STT_ERROR')
        } else if (event.type !== 'connected') {
          return fail('Gnani sent an unsupported STT response.', 'INVALID_UPSTREAM_RESPONSE')
        }
      })
      upstream.on('unexpected-response', () => {
        fail('Gnani rejected the STT connection. Check the server API key and configuration.', 'GNANI_STT_CONNECTION_FAILED')
      })
      upstream.on('error', () => {
        fail('Could not connect to Gnani transcription.', 'GNANI_STT_UNAVAILABLE')
      })
      upstream.on('close', () => {
        if (!closed && client.readyState === WebSocket.OPEN) {
          closed = true
          client.close(1011, 'STT connection closed')
        }
      })
    }

    client.on('message', (raw, isBinary) => {
      if (!started) {
        if (isBinary) return fail('Send STT settings before audio.', 'INVALID_SESSION')
        let message
        try {
          message = JSON.parse(raw.toString())
        } catch {
          return fail('Invalid STT session settings.', 'INVALID_SESSION')
        }
        startUpstream(message)
        return
      }
      if (!isBinary || raw.length !== GNANI_FRAME_BYTES) {
        return fail('Audio must be sent as 1,024-byte PCM frames.', 'INVALID_AUDIO_FRAME')
      }
      if (!upstream || upstream.readyState !== WebSocket.OPEN) {
        return fail('The Gnani STT connection is not ready.', 'GNANI_STT_UNAVAILABLE')
      }
      if (upstream.bufferedAmount > GNANI_FRAME_BYTES * 32) {
        return fail('The STT connection is receiving audio too quickly.', 'AUDIO_BACKPRESSURE')
      }
      upstream.send(raw, { binary: true })
    })
    client.on('close', () => {
      clearTimeout(sessionTimeout)
      closed = true
      closeUpstream()
    })
    client.on('error', () => {
      clearTimeout(sessionTimeout)
      closed = true
      closeUpstream()
    })
  })

  wss.on('connection', (ws) => {
    clients.add(ws)
    console.log('WebSocket client connected')

    // Send welcome message
    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Connected to SavitaOS' }))

    // ── Handle incoming messages (voice commands) ─────────────────────────
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        handleClientMessage(ws, msg)
      } catch (err) {
        // Non-JSON messages are ignored (e.g. pong frames)
      }
    })

    ws.on('close', () => {
      geminiVoice.stopSession(ws)
      clients.delete(ws)
      // Clean up session mapping
      if (ws._sessionId) sessionClients.delete(ws._sessionId)
      console.log('WebSocket client disconnected')
    })

    ws.on('error', (err) => {
      console.error('WebSocket error:', err)
      geminiVoice.stopSession(ws)
      clients.delete(ws)
      if (ws._sessionId) sessionClients.delete(ws._sessionId)
    })
  })

  // Initialize filesystem watcher
  initWatcher()

  // Heartbeat every 30 seconds - store ID for cleanup
  heartbeatInterval = setInterval(() => {
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.ping()
      }
    })
  }, 30000)

  return wss
}

/**
 * Cleanup WebSocket resources (call on server shutdown)
 */
function cleanupWS() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
    console.log('WebSocket heartbeat interval cleared')
  }

  // Clean up all voice sessions
  geminiVoice.cleanupAll()

  // Close all client connections gracefully
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.close(1001, 'Server shutting down')
    }
  })
  clients.clear()

  if (gnaniWssInstance) {
    gnaniWssInstance.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.close(1001, 'Server shutting down')
    })
    gnaniWssInstance.close()
    gnaniWssInstance = null
  }
  if (wssInstance) {
    wssInstance.close()
    wssInstance = null
  }

  // Close watcher
  if (watcher) {
    watcher.close()
    watcher = null
  }

  console.log('WebSocket cleanup completed')
}

/**
 * Initialize filesystem watcher
 */
function initWatcher() {
  // Use the same repo-local filesystem root as the desktop shell.
  const watchRoot = resolveWatchRoot()

  if (watcher) {
    watcher.close()
  }

  watcher = chokidar.watch(watchRoot, {
    ignored: /(^|[\/\\])(\.|node_modules)/,
    persistent: true,
    ignoreInitial: true,
    depth: 4   // avoid watching deeply nested dirs like node_modules subtrees
  })

  watcher
    .on('add', (filePath) => {
      broadcast({
        type: 'FS_CHANGE',
        path: filePath,
        changeType: 'add'
      })
    })
    .on('unlink', (filePath) => {
      broadcast({
        type: 'FS_CHANGE',
        path: filePath,
        changeType: 'remove'
      })
    })
    .on('change', (filePath) => {
      broadcast({
        type: 'FS_CHANGE',
        path: filePath,
        changeType: 'modify'
      })
    })
    .on('error', (err) => {
      console.error('Filesystem watcher error:', err)
    })
}

/**
 * Broadcast event to all connected clients
 * @param {Object} event - Event object
 */
function broadcast(event) {
  const message = JSON.stringify(event)
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}

/**
 * Send event to specific session
 * @param {string} sessionId - Session ID
 * @param {Object} event - Event object
 */
function sendToSession(sessionId, event) {
  const ws = sessionClients.get(sessionId)
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event))
  } else {
    // Fallback to broadcast only if no session mapping exists
    broadcast(event)
  }
}

function sendNotification(message, level = 'info', sessionId) {
  const event = { type: 'NOTIFICATION', message, level }
  if (sessionId) {
    sendToSession(sessionId, event)
  } else {
    broadcast(event)
  }
}

function sendAgentStatus(agent, status, sessionId) {
  const event = { type: 'AGENT_STATUS', agent, status }
  if (sessionId) {
    sendToSession(sessionId, event)
  } else {
    broadcast(event)
  }
}

// ── Voice message router ──────────────────────────────────────────────────────

function handleClientMessage(ws, msg) {
  switch (msg.type) {
    case 'identify': {
      // Register this connection under a session ID so targeted sends work
      const sid = msg.sessionId
      if (sid) {
        ws._sessionId = sid
        sessionClients.set(sid, ws)
        console.log('[WS] Session registered:', sid)
      }
      break
    }

    case 'voice-start': {
      // Start a Gemini Live voice session for this client
      console.log('[WS] Voice session start requested', msg.voice || 'default')
      geminiVoice.startSession(ws, { voice: msg.voice })
      break
    }

    case 'voice-chunk': {
      // Forward audio chunk (base64 PCM 16kHz) to Gemini
      if (msg.audio) {
        geminiVoice.sendAudio(ws, msg.audio)
      }
      break
    }

    case 'voice-stop': {
      // End the voice session
      console.log('[WS] Voice session stop requested')
      geminiVoice.stopSession(ws)
      break
    }

    case 'voice-status': {
      // Return voice engine status
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'voice-status',
            ...geminiVoice.getStatus()
          }))
        }
      } catch (_) {}
      break
    }

    default:
      // Unknown message types are silently ignored
      break
  }
}

module.exports = {
  initWS,
  cleanupWS,
  broadcast,
  sendToSession,
  sendNotification,
  sendAgentStatus
}
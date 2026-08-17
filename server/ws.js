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

// Store active connections
const clients = new Set()
// session-id → WebSocket mapping for targeted messaging (H1 fix)
const sessionClients = new Map()

let watcher = null
let heartbeatInterval = null
let wssInstance = null

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
  const wss = new WebSocket.Server({ server: httpServer })
  wssInstance = wss

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
/**
 * Agent route — POST /api/agent/chat
 *
 * Dual-engine architecture:
 *   1. IRIS engine (Gemini + tool-calling) — primary
 *   2. Spirit engine (offline NLP) — automatic fallback
 *
 * The irisEngine module handles routing, timeout, and graceful degradation.
 * Conversation memory is persisted in the AgentSession table.
 */

const express   = require('express')
const router    = express.Router()
const rateLimit = require('express-rate-limit')
const { validate, schemas } = require('../middleware/validate')
const irisEngine = require('../lib/irisEngine')
const ws         = require('../ws')
const prisma     = require('../lib/prisma')

// 60 req/min/IP — generous for local usage.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { message: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false
})

function broadcastStatus(source, status, sessionId) {
  try {
    if (ws.sendAgentStatus) ws.sendAgentStatus(source, status, sessionId)
  } catch (_) { /* WS may not be ready yet */ }
}

router.post('/chat', limiter, validate(schemas.chatMessage), async (req, res) => {
  const { message, osState } = req.validated
  let sessionId = req.session?.userName
  if (!sessionId) {
    if (!req.session.anonId) {
      req.session.anonId = 'anon_' + Math.random().toString(36).slice(2, 10)
    }
    sessionId = req.session.anonId
  }
  broadcastStatus('iris', 'thinking', sessionId)

  try {
    const startMs = Date.now()
    const result = await irisEngine.process(message, { osState, sessionId, prisma }, prisma)
    const durationMs = Date.now() - startMs
    broadcastStatus(result.source || 'iris', 'done', sessionId)

    res.json({
      message:        result.message,
      action:         result.action || null,
      data:           result.toolData || null,
      source:         result.source,           // 'iris' | 'spirit' | 'error'
      agent:          result.source,
      agents:         result.tools || [result.source],
      duration_ms:    result.duration_ms || durationMs,
      fallbackReason: result.fallbackReason || null,
      plan:           { agent: result.source, confidence: result.source === 'iris' ? 0.95 : 1, task: message }
    })
  } catch (err) {
    console.error('Agent route error:', err)
    broadcastStatus('error', 'error', sessionId)
    res.status(500).json({
      message:     "I had trouble understanding that. Please try again.",
      action:      null,
      source:      'error',
      agent:       'error',
      agents:      [],
      duration_ms: 0
    })
  }
})

/**
 * GET /api/agent/status — Engine health check
 *
 * Returns which engine is primary, whether IRIS (Gemini) is available,
 * and the configured fallback timeout.
 */
router.get('/status', (req, res) => {
  res.json(irisEngine.getEngineStatus())
})

/**
 * GET /api/agent/voice-status — Voice engine health check
 *
 * Returns whether Gemini Live voice is available, supported voices,
 * and the number of active voice sessions.
 */
router.get('/voice-status', (req, res) => {
  try {
    const geminiVoice = require('../lib/geminiVoice')
    res.json(geminiVoice.getStatus())
  } catch (err) {
    res.json({
      available: false,
      error: err.message,
      activeSessions: 0,
      voices: [],
      defaultVoice: null
    })
  }
})

module.exports = router

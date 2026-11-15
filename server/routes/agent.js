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
const { z } = require('zod')
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

const voicePlanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  message: { error: 'Voice planner limit reached. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false
})

const voicePlanSchema = z.object({
  message: z.string().min(1).max(1000),
  language: z.enum(['english', 'hindi', 'marathi', 'tamil']),
  osState: z.record(z.any()).optional(),
  sessionHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(500)
  })).max(8).optional()
}).strict()

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

router.post('/voice-plan', voicePlanLimiter, async (req, res) => {
  const parsed = voicePlanSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid voice planner request.',
      details: parsed.error.issues.map(({ path, message }) => ({ path: path.join('.'), message }))
    })
  }

  const { message, language, osState, sessionHistory } = parsed.data
  try {
    const plan = await irisEngine.planVoiceAction({
      message,
      language,
      osState,
      sessionHistory
    })
    return res.json(plan)
  } catch (error) {
    const status = error.message === 'NO_API_KEY' ? 503 : 502
    console.warn('[Agent] Voice planner unavailable:', error.message)
    return res.status(status).json({
      error: 'Voice planner is temporarily unavailable.',
      reply: language === 'hindi'
        ? 'अभी अनुरोध समझने में समस्या है। कृपया फिर से कहें।'
        : language === 'marathi'
          ? 'सध्या विनंती समजण्यात अडचण आहे. कृपया पुन्हा सांगा.'
          : language === 'tamil'
            ? 'கோரிக்கையைப் புரிந்துகொள்ள முடியவில்லை. மீண்டும் சொல்லுங்கள்.'
          : 'I could not process that request just now. Please try again.'
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

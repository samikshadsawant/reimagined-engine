/**
 * server/lib/openRouterClient.js — Free-Model Fallback via OpenRouter
 *
 * Inspired by Mark-XXXIX-OR's model rotation pattern.
 * Routes LLM calls through OpenRouter's free-tier models with
 * automatic retry and rate-limit cooldown per model.
 *
 * Usage:
 *   const { chatWithOpenRouter } = require('./openRouterClient')
 *   const reply = await chatWithOpenRouter('Hello, who are you?', systemPrompt)
 */

const _process = require('process')

// ── Free-tier model pools (ordered by quality) ──────────────────────────────

const TEXT_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',   // verified working
  'qwen/qwen3-coder:free',
  'google/gemma-4-31b-it:free',
  'arcee-ai/trinity-large-preview:free',
  'google/gemma-3-12b-it:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'meta-llama/llama-3.2-3b-instruct:free',
]

// ── Config ──────────────────────────────────────────────────────────────────

const API_URL             = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MAX_TOKENS  = 2048
const DEFAULT_TEMPERATURE = 0.7
const REQUEST_TIMEOUT_MS  = 30000
const MAX_RETRIES          = 2
const RETRY_DELAY_MS       = 1500
const RATE_LIMIT_COOLDOWN  = 60000  // 60s before retrying a rate-limited model

// Track rate-limited models with timestamps
const rateLimited = new Map()

// ── Internal helpers ────────────────────────────────────────────────────────

function isRateLimited(model) {
  const ts = rateLimited.get(model)
  if (!ts) return false
  if (Date.now() - ts > RATE_LIMIT_COOLDOWN) {
    rateLimited.delete(model)
    return false
  }
  return true
}

async function callModel(apiKey, model, messages, maxTokens, temperature) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/SpiritOS',
        'X-Title': 'SpiritOS IRIS Engine'
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature
      }),
      signal: controller.signal
    })

    if (res.status === 429 || res.status === 402) {
      rateLimited.set(model, Date.now())
      console.warn(`[OpenRouter] ${res.status === 429 ? 'Rate limited' : 'No credits'}: ${model}`)
      return null
    }

    if (res.ok) {
      const data = await res.json()
      const content = data.choices?.[0]?.message?.content
      return content?.trim() || null
    }

    // 404 means model doesn't exist — skip permanently for this session
    if (res.status === 404) {
      rateLimited.set(model, Date.now() + 999999999) // effectively permanent
      console.warn(`[OpenRouter] ${model} → 404 not found, skipping`)
      return null
    }

    console.warn(`[OpenRouter] ${model} → HTTP ${res.status}`)
    return null
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`[OpenRouter] ${model} → Timeout`)
    } else {
      console.warn(`[OpenRouter] ${model} → Error: ${err.message}`)
    }
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Send a chat message through OpenRouter's free models.
 * Tries models in order, skipping rate-limited ones.
 *
 * @param {string} userMessage - User's input
 * @param {string} systemPrompt - System instruction
 * @param {Object} opts - { maxTokens, temperature }
 * @returns {string|null} - Response text, or null if all models fail
 */
async function chatWithOpenRouter(userMessage, systemPrompt, opts = {}) {
  const apiKey = _process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  const messages = [
    { role: 'system', content: systemPrompt || 'You are IRIS, a helpful AI assistant for SpiritOS.' },
    { role: 'user', content: userMessage }
  ]

  const maxTokens = opts.maxTokens || DEFAULT_MAX_TOKENS
  const temperature = opts.temperature || DEFAULT_TEMPERATURE

  for (const model of TEXT_MODELS) {
    if (isRateLimited(model)) continue

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const result = await callModel(apiKey, model, messages, maxTokens, temperature)
      if (result) {
        console.log(`[OpenRouter] ✓ ${model}`)
        return result
      }
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
      }
    }
  }

  console.warn('[OpenRouter] All free models exhausted')
  return null
}

/**
 * Check if OpenRouter is available (has API key configured).
 */
function isOpenRouterAvailable() {
  return !!_process.env.OPENROUTER_API_KEY
}

/**
 * Get status info about the model pool.
 */
function getOpenRouterStatus() {
  return {
    available: isOpenRouterAvailable(),
    totalModels: TEXT_MODELS.length,
    rateLimited: [...rateLimited.keys()],
    activeModels: TEXT_MODELS.filter(m => !isRateLimited(m)).length
  }
}

module.exports = {
  chatWithOpenRouter,
  isOpenRouterAvailable,
  getOpenRouterStatus,
  TEXT_MODELS
}

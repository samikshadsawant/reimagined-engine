/**
 * server/lib/irisEngine.js — Triple-Engine Router
 *
 * The keystone of the IRIS integration. Routes user input through:
 *   1. IRIS engine (Gemini + function-calling) — primary
 *   2. OpenRouter (free LLM models) — fallback tier 1
 *   3. Spirit engine (existing offline NLP) — fallback tier 2
 *
 * Fallback chain:
 *   - Gemini fails/timeout → try OpenRouter free models
 *   - OpenRouter fails/unavailable → Spirit offline engine
 *   - Spirit fails → error message
 *
 * Architecture:
 *   userInput ──▶ irisEngine.process(input)
 *                     │
 *                     ├── Try: Gemini tool-calling (timeout)
 *                     │     ├── Success → { source: 'iris', result }
 *                     │     └── Error/Timeout ──┐
 *                     │                         │
 *                     ├── Try: OpenRouter free models
 *                     │     ├── Success → { source: 'openrouter', result }
 *                     │     └── Fail ──┐
 *                     │                │
 *                     └── Fallback: Spirit engine
 *                           └── { source: 'spirit', result }
 */

const { GoogleGenerativeAI } = require('@google/generative-ai')
const { toolRegistry, toolDeclarations } = require('./irisTools')
const { spirit } = require('./spirit')
const { chatWithOpenRouter, isOpenRouterAvailable, getOpenRouterStatus } = require('./openRouterClient')
const _process = require('process')  // Reliable ref — avoids Node 24 CJS scope quirks

// ── Configuration (deferred to avoid module-init-order issues) ──────────────

function getFallbackTimeout() {
  return parseInt(_process.env.AI_FALLBACK_TIMEOUT_MS || '10000')
}
function getPrimaryEngine() {
  return _process.env.AI_PRIMARY_ENGINE || 'iris'
}

// ── Gemini model fallback chain ─────────────────────────────────────────────
// Each model has independent rate-limit quotas on the free tier.
// We try them in order; if one is 429'd we cache that and skip it next time.

const GEMINI_MODELS = [
  'gemini-2.5-flash',        // newest, separate quota
  'gemini-2.0-flash',        // primary workhorse
  'gemini-2.0-flash-lite',   // lighter, separate quota
]

let genAI = null

// Cache 429 status per model (model → timestamp). Cooldown: 5 minutes.
const gemini429Cache = new Map()
const GEMINI_429_COOLDOWN = 5 * 60 * 1000

function isGeminiModelAvailable(modelName) {
  const ts = gemini429Cache.get(modelName)
  if (!ts) return true
  if (Date.now() - ts > GEMINI_429_COOLDOWN) {
    gemini429Cache.delete(modelName)
    return true
  }
  return false
}

function getGenAI() {
  if (genAI) return genAI
  const apiKey = _process.env.GEMINI_API_KEY
  if (!apiKey) return null
  genAI = new GoogleGenerativeAI(apiKey)
  return genAI
}

function createModel(modelName) {
  const ai = getGenAI()
  if (!ai) return null
  return ai.getGenerativeModel({
    model: modelName,
    tools: [{ functionDeclarations: toolDeclarations }],
    systemInstruction: buildSystemPrompt()
  })
}

function buildSystemPrompt() {
  return `You are IRIS, the intelligent assistant powering SpiritOS — an accessible desktop operating system.

Your personality:
- Warm, concise, and helpful
- You prioritize action over explanation
- When a user wants something done (create file, open app, etc.), use the appropriate tool
- For conversational questions, respond naturally without using tools

Context:
- The filesystem root is: ${_process.env.FS_ROOT || 'user home directory'}
- The OS runs in a browser and has apps: File Explorer, Terminal, Notes, Calculator, Browser, Settings, Reminders, Presentations
- The user may have accessibility needs (low vision, motor impairment, cognitive support)

Rules:
- ALWAYS use tools when the user wants to perform an action (file ops, app control, etc.)
- Keep responses under 3 sentences unless the user asks for detail
- If a tool returns an 'action' field, include it in your response — the frontend will execute it
- Never execute destructive file operations without confirming with the user first
- When the user shares personal info (name, preferences, etc.), silently use save_memory`
}

// ── Load persistent memory into context ─────────────────────────────────────

function loadMemoryContext() {
  try {
    const fs = require('fs')
    const memPath = require('path').join(__dirname, '..', 'data', 'memory.json')
    const mem = JSON.parse(fs.readFileSync(memPath, 'utf-8'))
    const categories = Object.entries(mem)
    if (!categories.length) return ''

    const lines = []
    for (const [cat, entries] of categories) {
      for (const [key, val] of Object.entries(entries)) {
        lines.push(`- [${cat}] ${key}: ${val.value}`)
      }
    }
    if (!lines.length) return ''
    return `\n\nPersistent memories:\n${lines.join('\n')}`
  } catch (_) {
    return ''
  }
}

// ── IRIS Engine (Gemini + tool calling) ─────────────────────────────────────

async function processWithIris(message, context, signal) {
  if (!getGenAI()) throw new Error('NO_API_KEY')

  // ── Load conversation history from AgentSession ─────────────────────────
  let chatHistory = []
  if (context.sessionId && context.prisma) {
    try {
      const session = await context.prisma.agentSession.upsert({
        where:  { sessionId: context.sessionId },
        create: { sessionId: context.sessionId, history: '[]' },
        update: {}
      })
      chatHistory = JSON.parse(session.history || '[]').slice(-20)  // last 20 turns
    } catch (_) { /* non-fatal — continue without history */ }
  }

  // Build the user message with optional OS state context
  let userMsg = message
  if (context.osState) {
    const state = context.osState
    const ctxParts = []
    if (state.openWindows?.length) ctxParts.push(`Open apps: ${state.openWindows.join(', ')}`)
    if (state.focusedWindow) ctxParts.push(`Focused: ${state.focusedWindow}`)
    if (state.theme) ctxParts.push(`Theme: ${state.theme}`)
    if (state.userName) ctxParts.push(`User: ${state.userName}`)
    if (ctxParts.length) userMsg = `[OS State: ${ctxParts.join(' | ')}]\n\n${message}`
  }

  // Append memory context
  const memCtx = loadMemoryContext()
  if (memCtx) userMsg += memCtx

  // Try each Gemini model until one succeeds
  let lastError = null
  for (const modelName of GEMINI_MODELS) {
    if (signal?.aborted) throw new Error('IRIS_ABORTED')
    if (!isGeminiModelAvailable(modelName)) {
      console.log(`[IrisEngine] Skipping ${modelName} (429 cached)`)
      continue
    }

    try {
      console.log(`[IrisEngine] Trying Gemini model: ${modelName}`)
      const gemini = createModel(modelName)

      // Use chat mode so history is threaded into the request
      const geminiHistory = chatHistory.map(turn => ({
        role:  turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }]
      }))
      const chat   = gemini.startChat({ history: geminiHistory })
      const result = await chat.sendMessage(userMsg)
      if (signal?.aborted) throw new Error('IRIS_ABORTED')
      const response = result.response
      const candidate = response.candidates?.[0]

      if (!candidate) throw new Error('No response from Gemini')

      // Check for function calls
      const parts = candidate.content?.parts || []
      const functionCalls = parts.filter(p => p.functionCall)

      if (functionCalls.length > 0) {
        // Execute tool calls
        const toolResults = []
        let frontendAction = null

        for (const part of functionCalls) {
          if (signal?.aborted) throw new Error('IRIS_ABORTED')
          const { name, args } = part.functionCall
          const handler = toolRegistry[name]

          if (!handler) {
            toolResults.push({ tool: name, error: `Unknown tool: ${name}` })
            continue
          }

          try {
            const toolResult = await handler(args || {}, context)
            toolResults.push({ tool: name, result: toolResult })

            if (toolResult?.action) {
              frontendAction = { action: toolResult.action, target: toolResult.target }
            }
          } catch (err) {
            toolResults.push({ tool: name, error: err.message })
          }
        }

        if (signal?.aborted) throw new Error('IRIS_ABORTED')

        // Send tool results back to Gemini for a natural language summary
        const toolSummary = toolResults.map(t => {
          if (t.error) return `Tool ${t.tool} failed: ${t.error}`
          return `Tool ${t.tool} result: ${JSON.stringify(t.result)}`
        }).join('\n')

        const followUp = await chat.sendMessage(
          `The user asked: "${message}"\n\nI executed these tools:\n${toolSummary}\n\nGive a brief, natural response about what was done. Do NOT use any tools in this response.`
        )

        const finalText = followUp.response.text()

        // ── Persist turn to AgentSession ──────────────────────────────────
        if (context.sessionId && context.prisma) {
          const newHistory = [...chatHistory,
            { role: 'user',      content: message   },
            { role: 'assistant', content: finalText  }
          ].slice(-40)
          context.prisma.agentSession.upsert({
            where:  { sessionId: context.sessionId },
            create: { sessionId: context.sessionId, history: JSON.stringify(newHistory) },
            update: { history: JSON.stringify(newHistory) }
          }).catch(() => {})
        }

        return {
          message:  finalText,
          source:   'iris',
          model:    modelName,
          action:   frontendAction,
          tools:    toolResults.map(t => t.tool),
          toolData: toolResults
        }
      }

      // No function calls — pure text response
      const textParts = (result.response.candidates?.[0]?.content?.parts || []).filter(p => p.text)
      const responseText = textParts.map(p => p.text).join('')

      // ── Persist turn to AgentSession ──────────────────────────────────
      if (context.sessionId && context.prisma) {
        const newHistory = [...chatHistory,
          { role: 'user',      content: message       },
          { role: 'assistant', content: responseText  }
        ].slice(-40)
        context.prisma.agentSession.upsert({
          where:  { sessionId: context.sessionId },
          create: { sessionId: context.sessionId, history: JSON.stringify(newHistory) },
          update: { history: JSON.stringify(newHistory) }
        }).catch(() => {})
      }

      return {
        message: responseText || 'I processed your request.',
        source:  'iris',
        model:   modelName,
        action:  null,
        tools:   [],
        toolData: []
      }

    } catch (err) {
      if (err.message === 'IRIS_ABORTED') throw err   // propagate abort
      lastError = err
      const msg = err.message || ''
      if (msg.includes('429')) {
        console.warn(`[IrisEngine] ${modelName} → 429 rate limited, caching & trying next`)
        gemini429Cache.set(modelName, Date.now())
        continue
      }
      console.warn(`[IrisEngine] ${modelName} → Error: ${msg.substring(0, 100)}`)
    }
  }

  throw lastError || new Error('ALL_GEMINI_429')
}

// ── OpenRouter Fallback (free LLM models) ───────────────────────────────────

async function processWithOpenRouter(message, context) {
  // Build a context-rich prompt for the free model
  let prompt = message
  const memCtx = loadMemoryContext()
  if (memCtx) prompt += memCtx

  if (context.osState) {
    const state = context.osState
    const parts = []
    if (state.openWindows?.length) parts.push(`Open apps: ${state.openWindows.join(', ')}`)
    if (state.userName) parts.push(`User: ${state.userName}`)
    if (parts.length) prompt = `[OS State: ${parts.join(' | ')}]\n\n${prompt}`
  }

  const systemPrompt = `You are IRIS, the intelligent assistant of SpiritOS.
You prioritize action over explanation.

Available tools that you can invoke if the user wants to perform an action, search the web, or set reminders:
- create_reminder({"title": "reminder title", "time_of_day": "HH:mm"}) - Set reminders (e.g. pills, daily tasks).
- delete_reminder({"search_title": "reminder title"}) - Delete reminders.
- list_reminders({}) - List reminders.
- google_search({"query": "search query"}) - Search the web for real-time information, stock prices, news, sports scores, facts, weather.
- open_app({"app_name": "app"}) - Open calculators, terminals, notes, settings, reminders.
- close_app({"app_name": "app"}) - Close app.
- save_note({"title": "note title", "content": "note content"}) - Save notes.

If you want to call a tool, output a single line at the VERY END of your response in this EXACT format:
[[TOOL_CALL: toolName, {"param": "value"}]]

Keep final responses concise (under 3 sentences) unless asked otherwise.`

  const reply = await chatWithOpenRouter(prompt, systemPrompt)
  if (!reply) throw new Error('OPENROUTER_ALL_FAILED')

  // Check for custom tool call format
  const match = reply.match(/\[\[TOOL_CALL:\s*([a-zA-Z0-9_-]+),\s*({[\s\S]*?})\]\]/)
  if (match) {
    const toolName = match[1]
    const argsString = match[2]
    console.log(`[IrisEngine][OpenRouter] Detected tool call: ${toolName} with args: ${argsString}`)

    const handler = toolRegistry[toolName]
    if (handler) {
      try {
        const args = JSON.parse(argsString)
        const toolResult = await handler(args || {}, context)
        console.log(`[IrisEngine][OpenRouter] Tool ${toolName} succeeded:`, JSON.stringify(toolResult))

        // If it was a search or list tool, we feed results back for final answer
        if (toolName === 'google_search' || toolName === 'weather_report' || toolName === 'list_reminders') {
          const followUpPrompt = `The user asked: "${message}"\n\nI executed the tool ${toolName} and got: ${JSON.stringify(toolResult)}\n\nNow provide a brief, natural language response giving the user the final answer. Do NOT execute any more tools.`
          const finalReply = await chatWithOpenRouter(followUpPrompt, systemPrompt)
          return {
            message: finalReply || `Here are the results: ${JSON.stringify(toolResult)}`,
            source:  'openrouter',
            action:  toolResult?.action ? { action: toolResult.action, target: toolResult.target } : null,
            tools:   [toolName],
            toolData: [{ tool: toolName, result: toolResult }]
          }
        } else {
          // Simple action (create_reminder, open_app, save_note)
          const summaryPrompt = `The user asked: "${message}"\n\nI successfully executed the tool ${toolName} with args ${JSON.stringify(args)} and result: ${JSON.stringify(toolResult)}.\n\nState that this has been successfully completed in a single sentence. Do NOT execute any more tools.`
          const finalReply = await chatWithOpenRouter(summaryPrompt, systemPrompt)
          return {
            message: finalReply || `Successfully executed ${toolName}.`,
            source:  'openrouter',
            action:  toolResult?.action ? { action: toolResult.action, target: toolResult.target } : null,
            tools:   [toolName],
            toolData: [{ tool: toolName, result: toolResult }]
          }
        }
      } catch (err) {
        console.warn(`[IrisEngine][OpenRouter] Tool execution failed:`, err.message)
      }
    }
  }

  return {
    message: reply,
    source:  'openrouter',
    action:  null,
    tools:   [],
    toolData: []
  }
}

// ── Spirit Fallback ─────────────────────────────────────────────────────────

async function processWithSpirit(message, context, prisma) {
  const result = await spirit(message, context, prisma)
  return {
    message:     result.message,
    source:      'spirit',
    action:      result.action || null,
    agent:       result.agent,
    duration_ms: result.duration_ms
  }
}

// ── Triple-Engine Processor ─────────────────────────────────────────────────

/**
 * Process a user message through the triple-engine system.
 *
 * @param {string}  message  – User's natural language input
 * @param {Object}  context  – { osState, sessionId }
 * @param {Object}  prisma   – Prisma client (for Spirit fallback)
 * @returns {Object} – { message, source, action, ... }
 */
async function process(message, context, prisma) {
  // If Spirit-only mode is configured, skip everything else
  if (getPrimaryEngine() === 'spirit') {
    return processWithSpirit(message, context, prisma)
  }

  // ── Tier 1: Try Gemini (IRIS) with timeout + AbortController ──────────────
  const abortCtrl = new AbortController()
  try {
    const irisPromise  = processWithIris(message, context, abortCtrl.signal)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => {
        abortCtrl.abort()
        reject(new Error('IRIS_TIMEOUT'))
      }, getFallbackTimeout())
    )

    const result = await Promise.race([irisPromise, timeoutPromise])
    return result
  } catch (geminiErr) {
    const reason = geminiErr.message === 'NO_API_KEY'   ? 'no_api_key'
                 : geminiErr.message === 'IRIS_TIMEOUT'  ? 'timeout'
                 : 'error'

    console.warn(`[IrisEngine] Gemini failed (${reason}):`, geminiErr.message)

    // ── Tier 2: Try OpenRouter free models ────────────────────────────────
    if (isOpenRouterAvailable()) {
      try {
        console.log('[IrisEngine] Trying OpenRouter fallback...')
        const orResult = await processWithOpenRouter(message, context)
        orResult.fallbackReason = `gemini_${reason}`
        return orResult
      } catch (orErr) {
        console.warn('[IrisEngine] OpenRouter also failed:', orErr.message)
      }
    }

    // ── Tier 3: Spirit offline engine ─────────────────────────────────────
    try {
      console.log('[IrisEngine] Falling back to Spirit...')
      const fallback = await processWithSpirit(message, context, prisma)
      fallback.fallbackReason = reason
      return fallback
    } catch (spiritErr) {
      console.error('[IrisEngine] All engines failed:', spiritErr)
      return {
        message:  "I had trouble understanding that. Please try again.",
        source:   'error',
        action:   null,
        error:    spiritErr.message
      }
    }
  }
}

// ── Engine status helper (for frontend indicator) ───────────────────────────

function getEngineStatus() {
  const hasGeminiKey = !!_process.env.GEMINI_API_KEY
  const primary = getPrimaryEngine()
  const orStatus = getOpenRouterStatus()
  return {
    primary,
    irisAvailable: hasGeminiKey && primary !== 'spirit',
    openRouterAvailable: orStatus.available,
    openRouterModels: orStatus.activeModels,
    spiritAvailable: true,
    fallbackTimeoutMs: getFallbackTimeout()
  }
}

module.exports = { process, getEngineStatus, processWithIris, processWithOpenRouter, processWithSpirit }

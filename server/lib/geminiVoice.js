/**
 * server/lib/geminiVoice.js — Gemini Live API Voice Relay
 *
 * Architecture (server-to-server relay):
 *   Browser mic  →  SpiritOS WS  →  this module  →  Gemini Live WS
 *   Browser spk  ←  SpiritOS WS  ←  this module  ←  Gemini Live WS
 *
 * Audio format:
 *   Input:  16-bit PCM, 16 kHz, mono, little-endian (from browser)
 *   Output: 16-bit PCM, 24 kHz, mono, little-endian (from Gemini)
 *
 * The module manages per-client Gemini Live sessions, forwarding audio
 * bidirectionally and executing IRIS tool calls when Gemini requests them.
 */

const WebSocket = require('ws')
const { toolRegistry, toolDeclarations } = require('./irisTools')

// ── Configuration ───────────────────────────────────────────────────────────

const GEMINI_LIVE_MODEL = 'gemini-2.5-flash-live-preview'
const GEMINI_LIVE_FALLBACK = 'gemini-2.0-flash-live-001'
const GEMINI_WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

const VOICE_NAMES = ['Charon', 'Kore', 'Fenrir', 'Aoede', 'Puck']
const DEFAULT_VOICE = 'Charon'

// ── Active voice sessions (clientWs → geminiWs) ────────────────────────────

const sessions = new Map()

// ── Build the setup config sent to Gemini on session start ──────────────────

function buildSetupConfig(voiceName = DEFAULT_VOICE, modelName = GEMINI_LIVE_MODEL) {
  // Convert our tool declarations to Gemini Live format
  const tools = toolDeclarations.map(decl => ({
    functionDeclarations: [{
      name: decl.name,
      description: decl.description,
      parameters: decl.parameters
    }]
  }))

  return {
    setup: {
      model: `models/${modelName}`,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName
            }
          }
        }
      },
      systemInstruction: {
        parts: [{
          text: `You are IRIS, the intelligent voice assistant that powers SpiritOS — an accessible operating system.
You are currently speaking to the user via real-time voice.
Be concise, warm, and helpful. Keep responses under 2–3 sentences unless asked for detail.
You have access to tools for file management, web search, weather, notes, and memory.
When using tools, execute them and summarize the result conversationally.
If the user says their name or personal details, silently save them to memory using the save_memory tool.`
        }]
      },
      tools,
      outputAudioTranscription: {},
      inputAudioTranscription: {}
    }
  }
}

// ── Start a voice session for a client WebSocket ────────────────────────────

function startSession(clientWs, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    sendToClient(clientWs, {
      type: 'voice-error',
      error: 'GEMINI_API_KEY not configured'
    })
    return null
  }

  // Don't start a second session for the same client
  if (sessions.has(clientWs)) {
    console.log('[GeminiVoice] Session already exists for this client')
    return sessions.get(clientWs)
  }

  const voiceName = options.voice || DEFAULT_VOICE
  const modelName = options.model || GEMINI_LIVE_MODEL
  const wsUrl = `${GEMINI_WS_URL}?key=${apiKey}`

  console.log(`[GeminiVoice] Connecting to Gemini Live (model: ${modelName}, voice: ${voiceName})...`)

  const geminiWs = new WebSocket(wsUrl)
  const session = {
    geminiWs,
    clientWs,
    voiceName,
    modelName,
    ready: false,
    setupAcked: false
  }

  sessions.set(clientWs, session)

  // ── Gemini WS: open → send setup config ────────────────────────────────
  geminiWs.on('open', () => {
    console.log('[GeminiVoice] Connected to Gemini Live API')
    const config = buildSetupConfig(voiceName, modelName)
    geminiWs.send(JSON.stringify(config))
  })

  // ── Gemini WS: messages from Gemini ────────────────────────────────────
  geminiWs.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString())

      // Setup acknowledgment
      if (msg.setupComplete) {
        session.setupAcked = true
        session.ready = true
        console.log('[GeminiVoice] Session setup complete — ready for audio')
        sendToClient(clientWs, { type: 'voice-ready', voice: voiceName })
        return
      }

      // Server content (audio output, transcripts)
      if (msg.serverContent) {
        const sc = msg.serverContent

        // Audio response chunks → forward to client
        if (sc.modelTurn?.parts) {
          for (const part of sc.modelTurn.parts) {
            if (part.inlineData) {
              sendToClient(clientWs, {
                type: 'voice-audio',
                data: part.inlineData.data,       // base64 PCM
                mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000'
              })
            }
          }
        }

        // Input transcription (what user said)
        if (sc.inputTranscription?.text) {
          sendToClient(clientWs, {
            type: 'voice-transcript-user',
            text: sc.inputTranscription.text
          })
        }

        // Output transcription (what Gemini said)
        if (sc.outputTranscription?.text) {
          sendToClient(clientWs, {
            type: 'voice-transcript-ai',
            text: sc.outputTranscription.text
          })
        }

        // Turn complete
        if (sc.turnComplete) {
          sendToClient(clientWs, { type: 'voice-turn-complete' })
        }

        // Interrupted (barge-in)
        if (sc.interrupted) {
          sendToClient(clientWs, { type: 'voice-interrupted' })
        }
      }

      // Tool call — execute locally and send result back
      if (msg.toolCall) {
        sendToClient(clientWs, { type: 'voice-tool-start' })
        await handleToolCall(session, msg.toolCall)
      }

    } catch (err) {
      console.error('[GeminiVoice] Error processing Gemini message:', err.message)
    }
  })

  // ── Gemini WS: errors & close ──────────────────────────────────────────
  geminiWs.on('error', (err) => {
    console.error('[GeminiVoice] Gemini WS error:', err.message)
    sendToClient(clientWs, {
      type: 'voice-error',
      error: `Gemini connection error: ${err.message}`
    })
  })

  geminiWs.on('close', (code, reason) => {
    const reasonStr = reason ? reason.toString() : 'none'
    console.log(`[GeminiVoice] Gemini WS closed (code=${code}, reason=${reasonStr})`)

    // If 1008 (policy violation) = model not found, try fallback model
    if (code === 1008 && session.modelName !== GEMINI_LIVE_FALLBACK) {
      console.log(`[GeminiVoice] Retrying with fallback model: ${GEMINI_LIVE_FALLBACK}`)
      sessions.delete(clientWs)
      // Retry with fallback model
      startSession(clientWs, { voice: voiceName, model: GEMINI_LIVE_FALLBACK })
      return
    }

    sessions.delete(clientWs)
    sendToClient(clientWs, { type: 'voice-ended', code, reason: reasonStr })
  })

  return session
}

// ── Handle incoming audio chunk from the browser ────────────────────────────

function sendAudio(clientWs, base64Audio) {
  const session = sessions.get(clientWs)
  if (!session?.ready) return

  const msg = {
    realtimeInput: {
      audio: {
        data: base64Audio,
        mimeType: 'audio/pcm;rate=16000'
      }
    }
  }

  if (session.geminiWs.readyState === WebSocket.OPEN) {
    session.geminiWs.send(JSON.stringify(msg))
  }
}

// ── Handle tool calls from Gemini ───────────────────────────────────────────

async function handleToolCall(session, toolCall) {
  const functionResponses = []

  for (const fc of (toolCall.functionCalls || [])) {
    console.log(`[GeminiVoice] Tool call: ${fc.name}(${JSON.stringify(fc.args)})`)
    let responseData

    try {
      const handler = toolRegistry[fc.name]
      if (handler) {
        const result = await handler(fc.args || {})
        responseData = { result }
        // Also send tool result to the client for UI display
        sendToClient(session.clientWs, {
          type: 'voice-tool-result',
          tool: fc.name,
          args: fc.args,
          result
        })
      } else {
        responseData = { error: `Unknown tool: ${fc.name}` }
      }
    } catch (err) {
      console.error(`[GeminiVoice] Tool ${fc.name} error:`, err.message)
      responseData = { error: err.message }
    }

    functionResponses.push({
      name: fc.name,
      id: fc.id,
      response: responseData
    })
  }

  // Send tool responses back to Gemini
  const toolResponse = {
    toolResponse: {
      functionResponses
    }
  }

  if (session.geminiWs.readyState === WebSocket.OPEN) {
    session.geminiWs.send(JSON.stringify(toolResponse))
    sendToClient(session.clientWs, { type: 'voice-tool-done' })
  }
}

// ── Stop a voice session ────────────────────────────────────────────────────

function stopSession(clientWs) {
  const session = sessions.get(clientWs)
  if (!session) return

  console.log('[GeminiVoice] Stopping voice session')

  if (session.geminiWs.readyState === WebSocket.OPEN ||
      session.geminiWs.readyState === WebSocket.CONNECTING) {
    session.geminiWs.close(1000, 'User ended session')
  }

  sessions.delete(clientWs)
}

// ── Cleanup all sessions (on server shutdown) ───────────────────────────────

function cleanupAll() {
  for (const [clientWs, session] of sessions) {
    try {
      if (session.geminiWs.readyState === WebSocket.OPEN) {
        session.geminiWs.close(1001, 'Server shutting down')
      }
    } catch (_) {}
  }
  sessions.clear()
  console.log('[GeminiVoice] All voice sessions cleaned up')
}

// ── Utility: send JSON to client ────────────────────────────────────────────

function sendToClient(ws, data) {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    }
  } catch (_) {}
}

// ── Status ──────────────────────────────────────────────────────────────────

function getStatus() {
  return {
    available: !!process.env.GEMINI_API_KEY,
    activeSessions: sessions.size,
    model: GEMINI_LIVE_MODEL,
    voices: VOICE_NAMES,
    defaultVoice: DEFAULT_VOICE
  }
}

module.exports = {
  startSession,
  stopSession,
  sendAudio,
  cleanupAll,
  getStatus,
  VOICE_NAMES,
  DEFAULT_VOICE
}

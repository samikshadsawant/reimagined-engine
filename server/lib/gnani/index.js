const { config, apiUrl, languageChoices } = require('./config')

const AUDIO_TYPES = new Set([
  'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/ogg', 'audio/flac',
  'audio/aac', 'audio/mp4', 'audio/x-m4a', 'audio/mp4a-latm'
])

class GnaniError extends Error {
  constructor(message, statusCode = 502, code = 'GNANI_UPSTREAM_ERROR') {
    super(message)
    this.name = 'GnaniError'
    this.statusCode = statusCode
    this.code = code
  }
}

function ensureConfigured() {
  if (!config.apiKey) {
    throw new GnaniError('Gnani is not configured on the server.', 503, 'GNANI_NOT_CONFIGURED')
  }
}

function ensureLanguage(language, type) {
  const supported = type === 'stt' ? config.stt.languages : config.tts.languages
  if (typeof language !== 'string' || !supported.includes(language)) {
    throw new GnaniError(`Unsupported ${type.toUpperCase()} language.`, 400, 'UNSUPPORTED_LANGUAGE')
  }
  return language
}

async function assertUpstream(response) {
  if (response.ok) return response
  const status = response.status === 429 ? 503 : 502
  const code = response.status === 401 ? 'GNANI_AUTH_FAILED' : 'GNANI_UPSTREAM_ERROR'
  throw new GnaniError(
    response.status === 401
      ? 'Gnani rejected the server API key. Check GNANI_API_KEY.'
      : response.status === 429
        ? 'Gnani is rate limiting requests. Please try again shortly.'
        : `Gnani request failed with status ${response.status}.`,
    status,
    code
  )
}

async function transcribe({ buffer, filename, mimetype, language, signal }) {
  ensureConfigured()
  ensureLanguage(language, 'stt')
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > config.stt.maxUploadBytes) {
    throw new GnaniError('Audio file is empty or exceeds the configured upload limit.', 400, 'INVALID_AUDIO')
  }
  if (!AUDIO_TYPES.has(mimetype)) {
    throw new GnaniError('Unsupported audio format. Use WAV, MP3, OGG, FLAC, AAC, or M4A.', 400, 'UNSUPPORTED_AUDIO')
  }

  const form = new FormData()
  form.append('audio_file', new Blob([buffer], { type: mimetype }), filename || 'voice-audio')
  form.append('language_code', language)
  form.append('format', config.stt.format)

  let response
  try {
    response = await fetch(apiUrl(config.stt.restPath), {
      method: 'POST',
      headers: { 'X-API-Key-ID': config.apiKey },
      body: form,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(config.requestTimeoutMs)])
        : AbortSignal.timeout(config.requestTimeoutMs)
    })
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new GnaniError('Gnani transcription timed out.', 504, 'GNANI_TIMEOUT')
    }
    throw new GnaniError('Could not connect to Gnani transcription.', 502, 'GNANI_UNAVAILABLE')
  }

  await assertUpstream(response)
  const result = await response.json()
  if (typeof result.transcript !== 'string') {
    throw new GnaniError('Gnani returned an invalid transcription response.', 502, 'GNANI_INVALID_RESPONSE')
  }
  return { transcript: result.transcript }
}

async function synthesize({ text, language, speed, signal }) {
  ensureConfigured()
  ensureLanguage(language, 'tts')
  const voice = config.tts.voices[language] || config.tts.voices[language === 'auto' ? 'en-IN' : language]
  if (!voice) {
    throw new GnaniError('No Timbre voice is configured for the selected language.', 400, 'VOICE_NOT_CONFIGURED')
  }

  let response
  try {
    response = await fetch(apiUrl(config.tts.restPath), {
      method: 'POST',
      headers: {
        'X-API-Key-ID': config.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        voice,
        model: config.tts.model,
        language,
        speed: speed ?? config.tts.speed,
        audio_config: {
          sample_rate: config.tts.audio.sampleRate,
          num_channels: config.tts.audio.channels,
          sample_width: config.tts.audio.sampleWidth,
          encoding: config.tts.audio.encoding,
          container: config.tts.audio.container
        }
      }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(config.requestTimeoutMs)])
        : AbortSignal.timeout(config.requestTimeoutMs)
    })
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new GnaniError('Gnani speech synthesis timed out.', 504, 'GNANI_TIMEOUT')
    }
    throw new GnaniError('Could not connect to Gnani speech synthesis.', 502, 'GNANI_UNAVAILABLE')
  }

  await assertUpstream(response)
  const audio = Buffer.from(await response.arrayBuffer())
  if (!audio.length) throw new GnaniError('Gnani returned empty audio.', 502, 'GNANI_INVALID_RESPONSE')
  return { audio, contentType: response.headers.get('content-type') || 'audio/wav' }
}

function getLanguageChoice(id) {
  return languageChoices.find((choice) => choice.id === id)
}

module.exports = {
  GnaniError,
  ensureConfigured,
  ensureLanguage,
  transcribe,
  synthesize,
  getLanguageChoice
}

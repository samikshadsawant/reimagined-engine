const DEFAULT_STT_LANGUAGES = [
  'bn-IN', 'en-IN', 'gu-IN', 'hi-IN', 'kn-IN',
  'ml-IN', 'mr-IN', 'pa-IN', 'ta-IN', 'te-IN'
]
const DEFAULT_TTS_LANGUAGES = [
  'auto', 'bn-IN', 'en-IN', 'gu-IN', 'hi-IN',
  'kn-IN', 'ml-IN', 'mr-IN', 'pa-IN', 'ta-IN', 'te-IN'
]

function envNumber(name, fallback) {
  const value = process.env[name]
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`)
  return parsed
}

function envList(name, fallback) {
  return (process.env[name] === undefined
    ? fallback
    : process.env[name].split(',')
  ).map((value) => value.trim()).filter(Boolean)
}

const config = Object.freeze({
  apiKey: process.env.GNANI_API_KEY || '',
  apiBaseUrl: process.env.GNANI_API_BASE_URL || 'https://api.vachana.ai',
  stt: Object.freeze({
    model: process.env.GNANI_STT_MODEL || 'gnani-prisma-v2.5',
    restPath: process.env.GNANI_STT_REST_PATH || '/stt/v3',
    websocketPath: process.env.GNANI_STT_WS_PATH || '/stt/v3/stream',
    languages: envList('GNANI_STT_LANGUAGES', DEFAULT_STT_LANGUAGES),
    sampleRate: envNumber('GNANI_STT_SAMPLE_RATE', 16000),
    frameSamples: envNumber('GNANI_STT_FRAME_SAMPLES', 512),
    format: process.env.GNANI_STT_FORMAT || 'verbatim',
    vadThreshold: envNumber('GNANI_STT_VAD_THRESHOLD', 0.6),
    minSilenceMs: envNumber('GNANI_STT_MIN_SILENCE_MS', 400),
    maxUploadBytes: envNumber('GNANI_STT_MAX_UPLOAD_BYTES', 15 * 1024 * 1024)
  }),
  tts: Object.freeze({
    model: process.env.GNANI_TTS_MODEL || 'timbre-v2.5',
    restPath: process.env.GNANI_TTS_REST_PATH || '/api/v1/tts/inference',
    languages: envList('GNANI_TTS_LANGUAGES', DEFAULT_TTS_LANGUAGES),
    voices: Object.freeze({
      'en-IN': process.env.GNANI_TTS_VOICE_ENGLISH || 'Kaveri',
      'hi-IN': process.env.GNANI_TTS_VOICE_HINDI || 'Nalini',
      'mr-IN': process.env.GNANI_TTS_VOICE_MARATHI || 'Zahira',
      'ta-IN': process.env.GNANI_TTS_VOICE_TAMIL || 'Asmita'
    }),
    audio: Object.freeze({
      sampleRate: envNumber('GNANI_TTS_AUDIO_SAMPLE_RATE', 48000),
      channels: envNumber('GNANI_TTS_AUDIO_CHANNELS', 1),
      sampleWidth: envNumber('GNANI_TTS_AUDIO_SAMPLE_WIDTH', 2),
      encoding: process.env.GNANI_TTS_AUDIO_ENCODING || 'linear_pcm',
      container: process.env.GNANI_TTS_AUDIO_CONTAINER || 'wav'
    }),
    speed: envNumber('GNANI_TTS_SPEED', 1)
  }),
  requestTimeoutMs: envNumber('GNANI_REQUEST_TIMEOUT_MS', 15000)
})

const apiProtocol = new URL(config.apiBaseUrl).protocol
if (!['http:', 'https:'].includes(apiProtocol)) {
  throw new Error('GNANI_API_BASE_URL must use HTTP or HTTPS')
}
if (![8000, 16000, 44100, 48000].includes(config.stt.sampleRate)) {
  throw new Error('GNANI_STT_SAMPLE_RATE must be 8000, 16000, 44100, or 48000')
}
if (config.stt.frameSamples !== 512) {
  throw new Error('GNANI_STT_FRAME_SAMPLES must be 512 per the current realtime protocol')
}
if (![8000, 16000, 22050, 24000, 44100, 48000].includes(config.tts.audio.sampleRate)) {
  throw new Error('GNANI_TTS_AUDIO_SAMPLE_RATE is not supported by the Timbre API')
}
if (config.tts.audio.channels !== 1 || config.tts.audio.sampleWidth !== 2) {
  throw new Error('Timbre audio must use one channel and a 2-byte sample width')
}
if (config.requestTimeoutMs < 1000 || config.requestTimeoutMs > 120000) {
  throw new Error('GNANI_REQUEST_TIMEOUT_MS must be between 1000 and 120000')
}

const languageChoices = Object.freeze([
  { id: 'english', label: 'English', sttCode: 'en-IN', ttsCode: 'en-IN' },
  { id: 'hindi', label: 'Hindi', sttCode: 'hi-IN', ttsCode: 'hi-IN' },
  { id: 'marathi', label: 'Marathi', sttCode: 'mr-IN', ttsCode: 'mr-IN' },
  { id: 'tamil', label: 'Tamil', sttCode: 'ta-IN', ttsCode: 'ta-IN' }
].filter(({ sttCode, ttsCode }) =>
  config.stt.languages.includes(sttCode) && config.tts.languages.includes(ttsCode)
))

function apiUrl(pathname) {
  return new URL(pathname, `${config.apiBaseUrl.replace(/\/+$/, '')}/`)
}

function getStatus() {
  const configured = Boolean(config.apiKey)
  return {
    configured,
    sttConfigured: configured,
    ttsConfigured: configured,
    sttModel: config.stt.model,
    ttsModel: config.tts.model,
    sttSampleRate: config.stt.sampleRate,
    sttFrameSamples: config.stt.frameSamples,
    languages: languageChoices
  }
}

module.exports = { config, apiUrl, getStatus, languageChoices }

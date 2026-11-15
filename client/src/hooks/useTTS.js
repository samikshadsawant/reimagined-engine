/**
 * useTTS — Text-to-Speech for SpiritOS.
 *
 * Uses Gnani Timbre through the backend when available and browser speech
 * synthesis as a fallback. Standalone helpers remain usable outside React.
 */

import { useCallback, useRef } from 'react'
import useOsStore from '../store/osStore'
import { showToast } from '../components/Toast'

const CACHE_LIMIT = 30
const audioCache = new Map()
const speechQueue = []
let generation = 0
let queueRunning = false
let activeAbort = null
let activeAudio = null
let activeAudioUrl = null
let stopActivePlayback = null
let stopActiveBrowserSpeech = null

function emitProvider(provider) {
  window.dispatchEvent(new CustomEvent('spiritos:tts-provider', { detail: { provider } }))
}

function languageForBrowser(language) {
  if (language === 'hindi') return 'hi-IN'
  if (language === 'marathi') return 'mr-IN'
  if (language === 'tamil') return 'ta-IN'
  return 'en-IN'
}

function cacheAudio(key, blob) {
  if (audioCache.has(key)) audioCache.delete(key)
  audioCache.set(key, blob)
  if (audioCache.size > CACHE_LIMIT) {
    audioCache.delete(audioCache.keys().next().value)
  }
}

function cachedAudio(key) {
  const blob = audioCache.get(key)
  if (!blob) return null
  audioCache.delete(key)
  audioCache.set(key, blob)
  return blob
}

function playBrowserSpeech(text, options, generationId) {
  if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
    emitProvider('Unavailable')
    showToast('Speech playback is unavailable in this browser.', { duration: 5000 })
    return Promise.resolve()
  }

  emitProvider('Browser speechSynthesis')
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      if (stopActiveBrowserSpeech === finish) stopActiveBrowserSpeech = null
      resolve()
    }
    stopActiveBrowserSpeech = finish
    const utterance = new SpeechSynthesisUtterance(text)
    const state = useOsStore.getState()
    const language = state.voiceLanguage || 'english'
    const voices = window.speechSynthesis.getVoices()
    const languagePrefix = languageForBrowser(language).toLowerCase().slice(0, 2)
    const preferred = voices.find((voice) =>
      voice.name === state.voiceLocale && voice.lang.toLowerCase().startsWith(languagePrefix)
    ) || voices.find((voice) => voice.lang.toLowerCase().startsWith(languagePrefix)) ||
      voices.find((voice) => voice.name === state.voiceLocale)
    if (preferred) utterance.voice = preferred
    utterance.lang = preferred?.lang || languageForBrowser(language)
    utterance.rate = options.rate
    utterance.pitch = options.pitch
    utterance.volume = options.volume
    utterance.onend = finish
    utterance.onerror = (event) => {
      if (generationId === generation) {
        showToast(`Browser speech playback failed: ${event.error || 'unknown error'}`, { duration: 5000 })
      }
      finish()
    }
    window.speechSynthesis.speak(utterance)
  })
}

async function playTimbre(text, options, generationId) {
  const state = useOsStore.getState()
  const language = state.voiceLanguage || 'english'
  const cacheKey = JSON.stringify([text, language, options.rate])
  let blob = cachedAudio(cacheKey)

  if (!blob) {
    const controller = new AbortController()
    activeAbort = controller
    const response = await fetch('/api/gnani/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language, speed: options.rate }),
      signal: controller.signal
    })
    if (!response.ok) {
      const result = await response.json().catch(() => null)
      throw new Error(result?.error?.message || `Gnani Timbre request failed (${response.status}).`)
    }
    blob = await response.blob()
    if (!blob.size) throw new Error('Gnani Timbre returned empty audio.')
    if (generationId !== generation) return
    cacheAudio(cacheKey, blob)
  }

  if (generationId !== generation) return
  emitProvider('Gnani Timbre')
  activeAbort = null
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  activeAudio = audio
  activeAudioUrl = url
  await new Promise((resolve, reject) => {
    let settled = false
    const clean = () => {
      if (settled) return
      settled = true
      audio.onended = null
      audio.onerror = null
      if (activeAudio === audio) activeAudio = null
      if (activeAudioUrl === url) activeAudioUrl = null
      URL.revokeObjectURL(url)
    }
    const finish = () => {
      clean()
      resolve()
    }
    stopActivePlayback = finish
    audio.onended = finish
    audio.onerror = () => {
      clean()
      reject(new Error('Gnani Timbre audio could not be played.'))
    }
    audio.play().catch((error) => {
      clean()
      reject(error)
    })
  })
  stopActivePlayback = null
}

async function playQueuedSpeech(item) {
  if (item.id !== generation) {
    item.resolve()
    return
  }
  const state = useOsStore.getState()
  const profileRate = state.profile === 'elderly' ? 0.85 : 1
  const options = {
    rate: Math.max(0.85, Math.min(1.15, item.options.rate ?? profileRate)),
    pitch: item.options.pitch ?? 1,
    volume: item.options.volume ?? 1
  }

  try {
    await playTimbre(item.text, options, item.id)
  } catch (error) {
    if (item.id !== generation || error.name === 'AbortError') {
      item.resolve()
      return
    }
    activeAbort = null
    showToast('Gnani Timbre is unavailable. Using browser speech instead.', { duration: 4500 })
    await playBrowserSpeech(item.text, options, item.id)
  }
  item.resolve()
}

async function drainSpeechQueue() {
  if (queueRunning) return
  queueRunning = true
  while (speechQueue.length) {
    const item = speechQueue.shift()
    await playQueuedSpeech(item)
  }
  queueRunning = false
}

/** Speak a message. Set `queue: true` to play it after the current utterance. */
export function speak(text, options = {}) {
  if (typeof text !== 'string' || !text.trim() || typeof window === 'undefined') {
    return Promise.resolve()
  }

  if (!options.queue) cancelSpeech()
  const id = generation
  return new Promise((resolve) => {
    speechQueue.push({ text: text.trim(), options, id, resolve })
    void drainSpeechQueue()
  })
}

/** Stop active playback, abort an in-flight Timbre request, and clear queued speech. */
export function cancelSpeech() {
  generation += 1
  if (activeAbort) {
    activeAbort.abort()
    activeAbort = null
  }
  if (activeAudio) activeAudio.pause()
  if (stopActivePlayback) stopActivePlayback()
  stopActivePlayback = null
  if (activeAudio) {
    activeAudio.src = ''
    activeAudio = null
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl)
    activeAudioUrl = null
  }
  if (stopActiveBrowserSpeech) stopActiveBrowserSpeech()
  window.speechSynthesis?.cancel()
  while (speechQueue.length) speechQueue.shift().resolve()
}

if (typeof window !== 'undefined') {
  window.addEventListener('spiritos:speak', (event) => {
    if (event.detail?.text) void speak(event.detail.text, event.detail.options || {})
  })
}

export default function useTTS() {
  const ttsEnabled = useOsStore((state) => state.ttsEnabled)
  const lastSpoken = useRef('')
  const lastSpokeAt = useRef(0)

  const announce = useCallback((text, options = {}) => {
    if (!ttsEnabled || !text) return
    const now = Date.now()
    if (text === lastSpoken.current && now - lastSpokeAt.current < 2000) return
    lastSpoken.current = text
    lastSpokeAt.current = now
    void speak(text, options)
  }, [ttsEnabled])

  const cancel = useCallback(() => cancelSpeech(), [])
  return { announce, cancel, speak, ttsEnabled }
}

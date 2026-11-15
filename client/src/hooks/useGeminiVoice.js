/**
 * useGeminiVoice — Hybrid Voice Mode for SpiritOS
 *
 * Since the Gemini Live API (bidiGenerateContent) is not available on the
 * free-tier API key, this hook uses a hybrid approach:
 *
 *   1. Gnani Prisma (or browser speech fallback) captures the active mic as text
 *   2. Registry rules match locally; unmatched requests use the constrained IRIS planner
 *   3. Registry actions execute locally and replies use Gnani Timbre (or browser fallback)
 *
 * This gives us multilingual conversation without exposing general-purpose
 * tool calling to voice requests.
 *
 * When a paid Gemini API key with Live API access is available,
 * swap this for the raw WebSocket audio pipeline (code preserved in git).
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import axios from 'axios'
import useOsStore from '../store/osStore'
import useWindowStore from '../store/windowStore'
import {
  BrowserSpeechProvider,
  GnaniPrismaSpeechProvider,
  browserRecognitionLanguage
} from '../input/speechProviders'
import {
  executeVoiceAction,
  getVoiceActionReply,
  matchVoiceRequest,
  validateVoiceAction
} from '../input/voiceActions'
import { createVoiceActionContext } from '../input/voiceActionContext'
import { confirmVoiceAction, getVoiceString } from '../input/voiceLocalization'
import { speak as speakWithTTS, cancelSpeech } from './useTTS'

export default function useGeminiVoice() {
  const [isActive, setIsActive] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [transcriptUser, setTranscriptUser] = useState('')
  const [transcriptAI, setTranscriptAI] = useState('')
  const [lastTool, setLastTool] = useState(null)
  const [error, setError] = useState(null)
  const [speechProvider, setSpeechProvider] = useState('Browser Speech API')
  const [isProcessing, setIsProcessing] = useState(false)
  const isProcessingRef = useRef(false)

  const voiceLanguage = useOsStore((state) => state.voiceLanguage || 'english')

  const providerRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const isActiveRef = useRef(false)
  const conversationRef = useRef([]) // rolling context window
  const plannerCallsRef = useRef([])
  const lastUtteranceRef = useRef({ text: '', at: 0 })

  // Sync ref
  useEffect(() => { isActiveRef.current = isActive }, [isActive])

  // ── TTS: speak text aloud ─────────────────────────────────────────────────

  const speakText = useCallback((text) => speakWithTTS(text), [])

  // ── Build OS State snapshot for the LLM ───────────────────────────────────

  const buildOsState = useCallback(() => {
    const osState = useOsStore.getState()
    const windows = useWindowStore.getState().windows
    return {
      openWindows: windows.map(w => w.app),
      focusedWindow: windows.find(w => w.focused)?.app || null,
      userName: osState.userName,
      userProfile: osState.profile,
      theme: osState.theme,
      fontSize: osState.fontSize,
      fontWeight: osState.fontWeight,
      contrast: osState.contrast,
      cursorSize: osState.cursorSize,
      gestureEnabled: osState.gestureEnabled,
      voiceEnabled: osState.voiceEnabled,
      eyeTrackingEnabled: osState.eyeTrackingEnabled
    }
  }, [])

  // ── Process a user utterance through the registry-constrained planner ─────

  const processUtterance = useCallback(async (text) => {
    const transcript = text.trim()
    const { normalizedText, match, route } = matchVoiceRequest(transcript)
    if (!match && normalizedText.replace(/\s/gu, '').length < 3) return
    const now = Date.now()
    if (lastUtteranceRef.current.text === transcript && now - lastUtteranceRef.current.at < 2500) return
    lastUtteranceRef.current = { text: transcript, at: now }

    plannerCallsRef.current = plannerCallsRef.current.filter((timestamp) => now - timestamp < 60_000)
    if (!match && plannerCallsRef.current.length >= 10) {
      const limited = getVoiceString('rateLimit', voiceLanguage)
      setTranscriptAI(limited)
      await speakText(limited)
      return
    }
    if (!match) plannerCallsRef.current.push(now)

    setTranscriptUser(transcript)
    setIsProcessing(true)
    setTranscriptAI('')
    setLastTool(null)

    // Add to conversation context
    const history = conversationRef.current.slice(-8)
    conversationRef.current.push({ role: 'user', content: transcript })

    try {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[Voice][dev] Transcript route', {
          rawTranscript: transcript,
          normalizedText,
          matchedRoute: match ? route : 'planner',
          action: match?.id || null,
          params: match?.params || {}
        })
      }

      if (match) {
        const validation = validateVoiceAction(match.id, match.params)
        if (!validation.valid) throw new Error(validation.error)
        let reply = ''
        if (validation.action.risky) {
          if (!confirmVoiceAction(validation.action.description, voiceLanguage)) {
            reply = getVoiceString('cancelled', voiceLanguage)
          }
        }
        if (!reply) {
          const result = await executeVoiceAction(match.id, match.params, createVoiceActionContext())
          reply = ['system.time', 'system.date', 'system.battery'].includes(match.id) && typeof result === 'string'
            ? result
            : getVoiceActionReply(match.id, voiceLanguage, typeof result === 'string' ? result : '')
        }
        reply ||= getVoiceString('done', voiceLanguage)
        setTranscriptAI(reply)
        conversationRef.current.push({ role: 'assistant', content: reply })
        if (conversationRef.current.length > 12) conversationRef.current = conversationRef.current.slice(-12)
        await speakText(reply)
        return
      }

      const response = await axios.post('/api/agent/voice-plan', {
        message: transcript,
        language: voiceLanguage,
        osState: buildOsState(),
        sessionHistory: history
      })
      const plan = response.data
      if (!plan || typeof plan.reply !== 'string' ||
          (plan.action !== null && typeof plan.action !== 'string')) {
        throw new Error('Voice planner returned an invalid response.')
      }
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[Voice][dev] Planner result', {
          rawTranscript: transcript,
          normalizedText,
          matchedRoute: 'planner',
          action: plan.action,
          params: plan.params || {}
        })
      }

      let aiText = plan.reply
      if (plan.action) {
        const validation = validateVoiceAction(plan.action, plan.params)
        if (!validation.valid) throw new Error(validation.error)
        if (validation.action.risky) {
          if (!confirmVoiceAction(validation.action.description, voiceLanguage)) {
            aiText = getVoiceString('cancelled', voiceLanguage)
          } else {
            await executeVoiceAction(plan.action, plan.params, createVoiceActionContext())
          }
        } else {
          await executeVoiceAction(plan.action, plan.params, createVoiceActionContext())
        }
      }

      setTranscriptAI(aiText)
      conversationRef.current.push({ role: 'assistant', content: aiText })
      if (conversationRef.current.length > 12) conversationRef.current = conversationRef.current.slice(-12)
      await speakText(aiText)

    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Something went wrong'
      setTranscriptAI(`Error: ${errMsg}`)
      setError(errMsg)
      const localizedError = getVoiceString('requestError', voiceLanguage)
      await speakText(localizedError)
    } finally {
      setIsProcessing(false)
      isProcessingRef.current = false
    }
  }, [speakText, buildOsState, voiceLanguage])

  // ── Start continuous voice conversation ───────────────────────────────────

  const start = useCallback(async () => {
    if (isActiveRef.current) {
      console.log('[HybridVoice] Already active')
      return
    }

    setError(null)
    setTranscriptUser('')
    setTranscriptAI('')
    setLastTool(null)
    conversationRef.current = []
    plannerCallsRef.current = []
    lastUtteranceRef.current = { text: '', at: 0 }
    isActiveRef.current = true
    setIsActive(true)

    const handleTranscript = (text, isFinal) => {
      if (!isActiveRef.current || isProcessingRef.current || !text.trim()) return
      setTranscriptUser(text.trim())
      if (!isFinal) return
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        if (!isActiveRef.current || isProcessingRef.current) return
        isProcessingRef.current = true
        setIsProcessing(true)
        void processUtterance(text.trim()).finally(() => {
          isProcessingRef.current = false
          setIsProcessing(false)
        })
      }, 800)
    }

    const startBrowser = async () => {
      if (!isActiveRef.current) return
      setSpeechProvider('Browser Speech API')
      const browser = new BrowserSpeechProvider({
        language: browserRecognitionLanguage(voiceLanguage),
        onTranscript: handleTranscript,
        onStatus: (status) => {
          if (!isActiveRef.current) return
          setIsActive(status === 'listening' || status === 'connecting')
          setIsReady(status === 'listening')
        },
        onError: (error) => {
          if (!isActiveRef.current) return
          setError(error.message)
          setIsActive(false)
          setIsReady(false)
        }
      })
      providerRef.current = browser
      try {
        await browser.start()
      } catch (error) {
        if (isActiveRef.current) {
          setError(error.message)
          setIsActive(false)
          setIsReady(false)
        }
      }
    }

    let fallbackStarted = false
    let gnaniProviderActive = false
    const onProviderError = (error) => {
      if (!isActiveRef.current) return
      setError(error.message)
      if (gnaniProviderActive && !fallbackStarted) {
        fallbackStarted = true
        gnaniProviderActive = false
        providerRef.current?.stop()
        providerRef.current = null
        setError('Gnani Prisma failed. Switching to browser speech recognition.')
        void startBrowser()
      } else {
        setIsActive(false)
        setIsReady(false)
      }
    }

    try {
      const response = await fetch('/api/gnani/status')
      if (response.ok) {
        const status = await response.json()
        const selected = status.languages?.find((language) => language.id === voiceLanguage)
        if (status.sttConfigured && selected) {
          const gnaniProvider = new GnaniPrismaSpeechProvider({
            language: selected.id,
            sampleRate: status.sttSampleRate,
            frameSamples: status.sttFrameSamples,
            onTranscript: handleTranscript,
            onStatus: (providerStatus) => {
              if (!isActiveRef.current) return
              setIsActive(providerStatus === 'listening' || providerStatus === 'processing')
              setIsReady(providerStatus === 'listening')
            },
            onError: onProviderError
          })
          providerRef.current = gnaniProvider
          gnaniProviderActive = true
          setSpeechProvider('Gnani Prisma')
          try {
            await gnaniProvider.start()
            return
          } catch (error) {
            gnaniProviderActive = false
            gnaniProvider.stop()
            if (!isActiveRef.current) return
            setError(`Gnani Prisma unavailable: ${error.message}. Using browser speech.`)
          }
        }
      }
    } catch {
      if (isActiveRef.current) setError('Gnani status is unavailable. Using browser speech.')
    }
    await startBrowser()
  }, [processUtterance, voiceLanguage])

  // ── Stop voice session ──────────────────────────────────────────────────

  const stop = useCallback(() => {
    console.log('[HybridVoice] Stopping')

    isActiveRef.current = false

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (providerRef.current) {
      providerRef.current.stop()
      providerRef.current = null
    }

    cancelSpeech()

    setIsActive(false)
    setIsReady(false)
    setTranscriptUser('')
    setTranscriptAI('')
    setLastTool(null)
    setIsProcessing(false)
    conversationRef.current = []
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => { stop() }
  }, [stop])

  return {
    start,
    stop,
    isActive,
    isReady,
    transcriptUser,
    transcriptAI,
    lastTool,
    error,
    isProcessing,
    speechProvider
  }
}

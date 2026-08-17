/**
 * useGeminiVoice — Hybrid Voice Mode for SpiritOS
 *
 * Since the Gemini Live API (bidiGenerateContent) is not available on the
 * free-tier API key, this hook uses a hybrid approach:
 *
 *   1. Web Speech API SpeechRecognition → captures mic as text
 *   2. POST /api/agent/chat → sends text to IRIS (Gemini/OpenRouter/Spirit)
 *   3. Web Speech API SpeechSynthesis → speaks the response aloud
 *
 * This gives us natural conversation with full tool-calling support,
 * works offline (browser speech APIs), and is free-tier compatible.
 *
 * When a paid Gemini API key with Live API access is available,
 * swap this for the raw WebSocket audio pipeline (code preserved in git).
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import axios from 'axios'
import useOsStore from '../store/osStore'
import useWindowStore from '../store/windowStore'
import { getDefaultSize } from '../config/appConfig'

// ── SpeechRecognition polyfill ──────────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

export default function useGeminiVoice() {
  const [isActive, setIsActive] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [transcriptUser, setTranscriptUser] = useState('')
  const [transcriptAI, setTranscriptAI] = useState('')
  const [lastTool, setLastTool] = useState(null)
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const isProcessingRef = useRef(false)

  const voiceLocale = useOsStore((state) => state.voiceLocale)

  const recognitionRef = useRef(null)
  const isActiveRef = useRef(false)
  const conversationRef = useRef([]) // rolling context window

  // Sync ref
  useEffect(() => { isActiveRef.current = isActive }, [isActive])

  // ── TTS: speak text aloud ─────────────────────────────────────────────────

  const speakText = useCallback((text) => {
    return new Promise((resolve) => {
      if (!text || !window.speechSynthesis) {
        resolve()
        return
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.05
      utterance.pitch = 1.0
      utterance.volume = 1.0

      // Try to pick selected voice or a good fallback
      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(v => v.name === voiceLocale) ||
        voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
        voices.find(v => v.lang.startsWith('en') && v.name.includes('Female')) ||
        voices.find(v => v.lang.startsWith('en'))

      if (preferred) utterance.voice = preferred

      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()

      window.speechSynthesis.speak(utterance)
    })
  }, [voiceLocale])

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

  // ── Execute agent action locally ──────────────────────────────────────────

  const executeAgentAction = useCallback((action) => {
    if (!action) return

    const windowStore = useWindowStore.getState()
    const osState = useOsStore.getState()

    console.log('[HybridVoice] Executing action:', action)

    switch (action.action) {
      case 'openApp':
        windowStore.openWindow(action.target, action.target, getDefaultSize(action.target))
        break
      case 'closeApp': {
        const focused = windowStore.windows.find(w => w.focused)
        if (focused) windowStore.closeWindow(focused.id)
        break
      }
      case 'switchWindow': {
        const target = windowStore.windows.find(w => w.app === action.target)
        if (target) windowStore.focusWindow(target.id)
        break
      }
      case 'nextWindow':     windowStore.focusNextWindow(); break
      case 'previousWindow': windowStore.focusPrevWindow(); break
      case 'showDesktop':
        windowStore.windows.forEach((w) => windowStore.minimizeWindow(w.id))
        break
      case 'applyProfile':
        osState.applyProfile(action.target)
        break
      case 'changeSetting':
        if (action.target === 'theme')      osState.setTheme(action.value)
        if (action.target === 'fontSize')   osState.setFontSize(action.value)
        if (action.target === 'fontWeight') osState.setFontWeight(action.value)
        if (action.target === 'gestureEnabled')
          osState.setGestureEnabled(action.value === true || action.value === 'true')
        if (action.target === 'voiceEnabled')
          osState.setVoiceEnabled(action.value === true || action.value === 'true')
        break
      case 'minimizeWindow': {
        const focused = windowStore.windows.find(w => w.focused)
        if (focused) windowStore.minimizeWindow(focused.id)
        break
      }
      case 'maximizeWindow': {
        const focused = windowStore.windows.find(w => w.focused)
        if (focused) windowStore.maximizeWindow(focused.id)
        break
      }
      case 'createReminder':
        if (action.title && /^\d{2}:\d{2}$/.test(action.timeOfDay || '')) {
          axios.post('/api/reminders', {
            title:      action.title,
            timeOfDay:  action.timeOfDay,
            daysMask:   '1111111',
            enabled:    true,
            speakAloud: true
          }).then(() => {
            window.dispatchEvent(new CustomEvent('spiritos:reminders-changed'))
          }).catch((err) => console.warn('[HybridVoice] createReminder failed:', err.message))
        }
        break
      case 'deleteReminder':
        axios.get('/api/reminders').then(({ data }) => {
          const needle = (action.match || '').toLowerCase()
          const target = needle
            ? (data || []).find((r) => r.title.toLowerCase().includes(needle))
            : (data || [])[0]
          if (target) {
            return axios.delete(`/api/reminders/${target.id}`).then(() => {
              window.dispatchEvent(new CustomEvent('spiritos:reminders-changed'))
            })
          }
        }).catch(() => {})
        break
      case 'triggerSOS':
        window.dispatchEvent(new CustomEvent('spiritos:sos'))
        break
      case 'openWebsite':
        if (action.url) window.open(action.url, '_blank', 'noopener,noreferrer')
        break
      case 'search':
        if (action.query) {
          window.open(
            `https://www.google.com/search?q=${encodeURIComponent(action.query)}`,
            '_blank', 'noopener,noreferrer'
          )
        }
        break
      case 'translate':
        windowStore.openWindow('Translator', 'Translator', getDefaultSize('Translator'))
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('spiritos:translate', {
            detail: { text: action.text, targetLang: action.target }
          }))
        }, 150)
        break
      default:
        break
    }
  }, [])

  // ── Process a user utterance through IRIS ─────────────────────────────────

  const processUtterance = useCallback(async (text) => {
    if (!text.trim()) return

    setTranscriptUser(text)
    setIsProcessing(true)
    setTranscriptAI('')
    setLastTool(null)

    // Add to conversation context
    conversationRef.current.push({ role: 'user', content: text })
    // Keep last 10 messages for context
    if (conversationRef.current.length > 10) {
      conversationRef.current = conversationRef.current.slice(-10)
    }

    try {
      console.log('[HybridVoice] Sending to IRIS:', text)

      const response = await axios.post('/api/agent/chat', {
        message: text,
        osState: buildOsState(),
        history: conversationRef.current.slice(0, -1) // exclude current message
      })

      const aiText = response.data?.message || response.data?.reply || "I didn't get a response."
      const action = response.data?.action
      const toolsUsed = response.data?.toolsUsed || []
      const agents = response.data?.agents || []

      // If a reminder tool was run, trigger UI refresh
      if (agents.some(a => a && a.includes('reminder'))) {
        window.dispatchEvent(new CustomEvent('spiritos:reminders-changed'))
      }

      // Show tool usage
      if (toolsUsed.length > 0) {
        setLastTool({ status: 'done', tool: toolsUsed.map(t => t.name || t).join(', ') })
      }

      // Update transcript
      setTranscriptAI(aiText)

      // Add AI response to conversation context
      conversationRef.current.push({ role: 'assistant', content: aiText })

      console.log('[HybridVoice] IRIS response:', aiText.substring(0, 100))

      // Execute action if any returned by agent
      if (action) {
        executeAgentAction(action)
      }

      // Speak the response aloud
      await speakText(aiText)

    } catch (err) {
      console.error('[HybridVoice] IRIS error:', err)
      const errMsg = err.response?.data?.error || err.message || 'Something went wrong'
      setTranscriptAI(`Error: ${errMsg}`)
      setError(errMsg)
      await speakText('Sorry, I encountered an error.')
    } finally {
      setIsProcessing(false)
      isProcessingRef.current = false
    }
  }, [speakText, buildOsState, executeAgentAction])

  // ── Start continuous voice conversation ───────────────────────────────────

  const start = useCallback(async () => {
    if (isActiveRef.current) {
      console.log('[HybridVoice] Already active')
      return
    }

    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser')
      return
    }

    setError(null)
    setTranscriptUser('')
    setTranscriptAI('')
    setLastTool(null)
    conversationRef.current = []

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognition.maxAlternatives = 1

      recognitionRef.current = recognition

      let silenceTimer = null

      recognition.onstart = () => {
        console.log('[HybridVoice] STT started — speak now')
        setIsActive(true)
        setIsReady(true)
      }

      recognition.onresult = (event) => {
        let interim = ''
        let localFinalTranscript = ''

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            localFinalTranscript += result[0].transcript
          } else {
            interim += result[0].transcript
          }
        }

        // Show interim/final transcript to user
        const fullUserText = (localFinalTranscript + ' ' + interim).trim()
        if (fullUserText) {
          setTranscriptUser(fullUserText)
        }

        if (localFinalTranscript.trim()) {
          // Clear any existing timer
          if (silenceTimer) clearTimeout(silenceTimer)

          const textToProcess = localFinalTranscript.trim()

          // Wait 800ms of silence before processing (allows multi-sentence input)
          silenceTimer = setTimeout(() => {
            if (isActiveRef.current) {
              // Pause recognition while processing
              isProcessingRef.current = true
              setIsProcessing(true)
              try { recognition.stop() } catch (_) {}

              processUtterance(textToProcess).then(() => {
                isProcessingRef.current = false
                setIsProcessing(false)
                // Resume listening after TTS finishes
                if (isActiveRef.current) {
                  try { recognition.start() } catch (_) {}
                }
              })
            }
          }, 800)
        }
      }

      recognition.onerror = (event) => {
        console.error('[HybridVoice] STT error:', event.error)
        if (event.error === 'not-allowed') {
          setError('Microphone access denied')
          setIsActive(false)
          setIsReady(false)
        } else if (event.error === 'no-speech') {
          // Normal — just means silence, will auto-restart
        } else if (event.error === 'aborted') {
          // We aborted it ourselves, ignore
        } else {
          setError(`Speech error: ${event.error}`)
        }
      }

      recognition.onend = () => {
        // Auto-restart if still active (handles browser auto-stop)
        if (isActiveRef.current && !isProcessingRef.current) {
          try {
            setTimeout(() => {
              if (isActiveRef.current) {
                recognition.start()
              }
            }, 300) // Increase delay to avoid rapid rate-limit block
          } catch (_) {}
        }
      }

      recognition.start()

      // Pre-load voices
      window.speechSynthesis?.getVoices()

    } catch (err) {
      setError(err.message)
      console.error('[HybridVoice] Start error:', err)
    }
  }, [processUtterance])

  // ── Stop voice session ──────────────────────────────────────────────────

  const stop = useCallback(() => {
    console.log('[HybridVoice] Stopping')

    isActiveRef.current = false

    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (_) {}
      recognitionRef.current = null
    }

    // Cancel any ongoing TTS
    window.speechSynthesis?.cancel()

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
    isProcessing
  }
}

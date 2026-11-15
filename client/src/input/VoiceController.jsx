/**
 * Voice Controller — SpiritOS Voice Navigation
 * Speak a command to control the OS.
 *
 * Commands:
 *   "open calculator"
 *   "close window"
 *   "go home"
 *   "minimize"
 *   "show desktop"
 *   "open D drive"
 *   "zoom in"
 *   "what time is it"
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useOsStore from '../store/osStore'
import useWindowStore from '../store/windowStore'
import useChatStore from '../store/chatStore'
import { cancelSpeech, speak } from '../hooks/useTTS'
import {
  executeVoiceAction,
  getVoiceActionReply,
  matchVoiceRequest,
  validateVoiceAction,
} from './voiceActions'
import { createVoiceActionContext } from './voiceActionContext'
import {
  confirmVoiceAction,
  getVoiceConfirmation,
  getVoiceString,
  isVoiceConfirmation,
  requiresSpokenConfirmation
} from './voiceLocalization'
import {
  BrowserSpeechProvider,
  GnaniPrismaSpeechProvider,
  browserRecognitionLanguage
} from './speechProviders'
import useGeminiVoice from '../hooks/useGeminiVoice'
import axios from 'axios'
import { normalizePlannerReminder } from './voiceReminderParser'
import { getWelcomeMessage } from './voiceWelcome'

// Wake word removed: when voice is enabled, every transcript is treated as a command.
const SILENCE_DEBOUNCE_MS = 1200

// ==================== VOICE HOOK ==================== //
function useVoice(active = true) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [lastCommand, setLastCommand] = useState(null) // { text, feedback, time }
  const [providerName, setProviderName] = useState('Browser Speech API')
  const [providerStatus, setProviderStatus] = useState('idle')
  const [languageOptions, setLanguageOptions] = useState([
    { id: 'english', label: 'English' },
    { id: 'hindi', label: 'Hindi' },
    { id: 'marathi', label: 'Marathi' },
    { id: 'tamil', label: 'Tamil' }
  ])
  const providerRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const lastHeardRef = useRef('')
  const lastExecutedRef = useRef('')
  const lastExecutedAtRef = useRef(0)
  const isCleanupRef = useRef(false) // Track if we're cleaning up
  const isProcessingRef = useRef(false)
  const plannerCallsRef = useRef([])
  const pendingConfirmationRef = useRef(null)
  const lastWelcomeKeyRef = useRef('')
  const welcomeSpeakingRef = useRef(false)
  const [micLevel, setMicLevel] = useState(0) // 0-100 audio level for diagnostics

  const {
    voiceEnabled,
    voiceLanguage = 'english',
    spokenWelcomeEnabled = true,
    addNotification
  } = useOsStore()

  // Use ref to always get current voiceEnabled value in callbacks
  const voiceEnabledRef = useRef(voiceEnabled && active)
  useEffect(() => { voiceEnabledRef.current = voiceEnabled && active }, [voiceEnabled, active])

  // Force stop listening - can be called externally
  const stopListening = useCallback(() => {
    isCleanupRef.current = true
    voiceEnabledRef.current = false
    pendingConfirmationRef.current = null
    if (welcomeSpeakingRef.current) cancelSpeech()
    welcomeSpeakingRef.current = false

    // Clear all timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (providerRef.current) {
      providerRef.current.stop()
      providerRef.current = null
    }
    setIsListening(false)
    setTranscript('')
    setProviderStatus('idle')
  }, [])

  const buildContext = useCallback(() => createVoiceActionContext(addNotification), [addNotification])

  function buildOsStateForAgent() {
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
  }

  const executeCommand = useCallback(async (commandText) => {
    const language = useOsStore.getState().voiceLanguage || 'english'
    const {
      normalizedText: normalizedCommand,
      match,
      route,
      clarification
    } = matchVoiceRequest(commandText, language)

    const logMatch = (matchedRoute, action, params) => {
      if (!import.meta.env.DEV) return
      // eslint-disable-next-line no-console
      console.debug('[Voice][dev] Transcript route', {
        rawTranscript: commandText,
        normalizedText: normalizedCommand,
        matchedRoute,
        action: action || null,
        params: params || {}
      })
    }
    const context = buildContext()
    let reply = ''
    let userTurnAdded = false
    let voiceLanguageChanged = false

    const pendingConfirmation = pendingConfirmationRef.current
    if (pendingConfirmation) {
      pendingConfirmationRef.current = null
      const confirmation = Date.now() - pendingConfirmation.createdAt < 30_000
        ? isVoiceConfirmation(commandText, language)
        : null
      if (confirmation !== null) {
        logMatch('spoken-confirmation', pendingConfirmation.actionId, pendingConfirmation.params)
        if (confirmation) {
          const result = await executeVoiceAction(
            pendingConfirmation.actionId,
            pendingConfirmation.params,
            context
          )
          reply = getVoiceActionReply(
            pendingConfirmation.actionId,
            language,
            typeof result === 'string' ? result : '',
            pendingConfirmation.params
          )
        } else {
          reply = getVoiceString('cancelled', language)
        }
        if (!reply) reply = getVoiceString('done', language)
        useChatStore.getState().push('user', commandText)
        useChatStore.getState().push('assistant', reply)
        speak(reply)
        addNotification(`🎤 ${reply}`, 'success')
        return true
      }
    }

    if (clarification) {
      logMatch('clarification', null, {})
      useChatStore.getState().push('user', commandText)
      useChatStore.getState().push('assistant', clarification)
      speak(clarification)
      addNotification(`🎤 ${clarification}`, 'info')
      return true
    }

    const requestSpokenConfirmation = (actionId, params, description) => {
      pendingConfirmationRef.current = { actionId, params, createdAt: Date.now() }
      const confirmationReply = getVoiceConfirmation(description, language, actionId, params)
      useChatStore.getState().push('user', commandText)
      useChatStore.getState().push('assistant', confirmationReply)
      speak(confirmationReply)
      addNotification(confirmationReply, 'warning')
    }

    if (match) {
      logMatch(route, match.id, match.params)
      const validation = validateVoiceAction(match.id, match.params)
      if (!validation.valid) throw new Error(validation.error)
      if (validation.action.risky) {
        if (requiresSpokenConfirmation(match.id)) {
          requestSpokenConfirmation(match.id, match.params, validation.action.description)
          return true
        }
        if (!confirmVoiceAction(validation.action.description, language)) {
          reply = getVoiceString('cancelled', language)
          speak(reply)
          useChatStore.getState().push('user', commandText)
          useChatStore.getState().push('assistant', reply)
          return true
        }
      }

      const actionResult = await executeVoiceAction(match.id, match.params, context)
      voiceLanguageChanged = match.id === 'voice.language' && match.params.language !== language
      reply = match.id === 'system.time' || match.id === 'system.date' || match.id === 'system.battery'
        ? actionResult || ''
        : getVoiceActionReply(match.id, language, typeof actionResult === 'string' ? actionResult : '', match.params)
      if (!reply) reply = getVoiceString('done', language)
    } else {
      if (normalizedCommand.replace(/\s/gu, '').length < 3) return false

      const now = Date.now()
      plannerCallsRef.current = plannerCallsRef.current.filter((timestamp) => now - timestamp < 60_000)
      if (plannerCallsRef.current.length >= 10) {
        reply = getVoiceString('rateLimit', language)
        speak(reply)
        return false
      }
      plannerCallsRef.current.push(now)

      const history = useChatStore.getState().recent(6)
      useChatStore.getState().push('user', commandText)
      userTurnAdded = true
      const response = await fetch('/api/agent/voice-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: commandText,
          language,
          osState: buildOsStateForAgent(),
          sessionHistory: history
        })
      })
      let plan = await response.json()
      if (!response.ok) {
        throw new Error(plan.reply || plan.error || `Voice planner failed (${response.status}).`)
      }
      if (typeof plan.reply !== 'string' || (plan.action !== null && typeof plan.action !== 'string')) {
        throw new Error('Voice planner returned an invalid response.')
      }
      if (plan.action === 'reminder.create') {
        const repaired = normalizePlannerReminder(plan.params, language)
        if (repaired.valid) {
          plan = { ...plan, params: repaired.params }
        } else {
          plan = { ...plan, action: null, params: {}, reply: repaired.reply }
        }
      }
      reply = plan.reply
      logMatch('planner', plan.action, plan.params)
      if (plan.action) {
        const validation = validateVoiceAction(plan.action, plan.params)
        if (!validation.valid) throw new Error(validation.error)
        if (validation.action.risky) {
          if (requiresSpokenConfirmation(plan.action)) {
            requestSpokenConfirmation(plan.action, plan.params, validation.action.description)
            return true
          }
          if (!confirmVoiceAction(validation.action.description, language)) {
            reply = getVoiceString('cancelled', language)
          } else {
            const result = await executeVoiceAction(plan.action, plan.params, context)
            voiceLanguageChanged = plan.action === 'voice.language' && plan.params.language !== language
            if (typeof result === 'string' && /^(sorry|could not|couldn't|i didn't)/iu.test(result.trim())) reply = result
          }
        } else {
          const result = await executeVoiceAction(plan.action, plan.params, context)
          voiceLanguageChanged = plan.action === 'voice.language' && plan.params.language !== language
          if (typeof result === 'string' && /^(sorry|could not|couldn't|i didn't)/iu.test(result.trim())) reply = result
        }
      }
    }

    if (!userTurnAdded) {
      useChatStore.getState().push('user', commandText)
    }
    useChatStore.getState().push('assistant', reply)
    const welcomeWillSpeak = voiceLanguageChanged && useOsStore.getState().spokenWelcomeEnabled !== false
    if (reply && !welcomeWillSpeak) speak(reply)
    setLastCommand({ text: commandText, feedback: reply, time: Date.now() })
    if (!welcomeWillSpeak) addNotification(`🎤 ${reply}`, 'success')
    return true
  }, [buildContext, addNotification])

  function executeIfNew(text) {
    const trimmed = text.trim()
    if (!trimmed) return

    const now = Date.now()
    if (lastExecutedRef.current === trimmed && (now - lastExecutedAtRef.current) < 2500) {
      return
    }
    lastExecutedRef.current = trimmed
    lastExecutedAtRef.current = now

    isProcessingRef.current = true

    void executeCommand(trimmed).catch((error) => {
      console.error('[Voice] Command execution failed:', error)
      const language = useOsStore.getState().voiceLanguage
      const reply = getVoiceString('commandError', language)
      speak(reply)
      addNotification(`${reply} ${error.message}`, 'error')
      return false
    }).then((handled) => {
      isProcessingRef.current = false
      if (handled) {
        setTranscript('')
      }
    })
  }

  function queueCommand(text) {
    lastHeardRef.current = text

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)

    silenceTimerRef.current = setTimeout(() => {
      executeIfNew(lastHeardRef.current)
    }, SILENCE_DEBOUNCE_MS)
  }

  useEffect(() => {
    if (!voiceEnabled || !active) {
      lastWelcomeKeyRef.current = ''
      return
    }
    if (!spokenWelcomeEnabled) lastWelcomeKeyRef.current = ''
    isCleanupRef.current = false
    let disposed = false
    let fallbackStarted = false

    const onTranscript = (text, isFinal) => {
      if (disposed || isCleanupRef.current || isProcessingRef.current) return
      setTranscript(text)
      if (text.trim()) queueCommand(text.trim(), isFinal ? 'final' : 'interim')
    }

    const startBrowserProvider = async () => {
      if (disposed) return
      const browser = new BrowserSpeechProvider({
        language: browserRecognitionLanguage(voiceLanguage),
        onTranscript,
        onStatus: (status) => {
          if (disposed) return
          setProviderStatus(status)
          setIsListening(status === 'listening' || status === 'processing')
        },
        onError: (error) => {
          if (disposed) return
          setProviderStatus('error')
          setIsListening(false)
          addNotification(`Speech input is unavailable: ${error.message}`, 'error')
        }
      })
      providerRef.current = browser
      setProviderName('Browser Speech API')
      try {
        await browser.start()
      } catch (error) {
        if (!disposed) {
          setProviderStatus('error')
          addNotification(`Speech input is unavailable: ${error.message}`, 'error')
        }
      }
    }

    const fallBackToBrowser = async (error) => {
      if (disposed || fallbackStarted) return
      fallbackStarted = true
      if (providerRef.current) {
        providerRef.current.stop()
        providerRef.current = null
      }
      setProviderName('Browser Speech API')
      setProviderStatus('fallback')
      addNotification(`Gnani Prisma is unavailable. Switching to browser speech recognition. ${error.message}`, 'warning')
      await startBrowserProvider()
    }

    const startProvider = async () => {
      setProviderStatus('connecting')
      try {
        const { data } = await axios.get('/api/gnani/status', { timeout: 5000 })
        if (Array.isArray(data.languages) && data.languages.length) setLanguageOptions(data.languages)
        if (data.sttConfigured) {
          const selectedLanguage = data.languages?.find((item) => item.id === voiceLanguage)
          if (!selectedLanguage) {
            throw new Error('The selected language is not enabled in the server configuration.')
          }
          const gnaniProvider = new GnaniPrismaSpeechProvider({
            language: selectedLanguage.id,
            sampleRate: data.sttSampleRate,
            frameSamples: data.sttFrameSamples,
            onTranscript,
            onStatus: (status) => {
              if (disposed) return
              setProviderStatus(status)
              setIsListening(status === 'listening' || status === 'processing')
            },
            onAudioLevel: setMicLevel,
            onError: (error) => { void fallBackToBrowser(error) }
          })
          providerRef.current = gnaniProvider
          setProviderName('Gnani Prisma')
          try {
            await gnaniProvider.start()
            if (disposed) gnaniProvider.stop()
            else setProviderName('Gnani Prisma')
            return
          } catch (error) {
            if (disposed) return
            await fallBackToBrowser(error)
            return
          }
        }
      } catch (error) {
        if (!disposed) {
          addNotification('Voice service configuration could not be loaded. Using browser speech recognition.', 'warning')
        }
      }
      await startBrowserProvider()
    }

    const startWithWelcome = async () => {
      const welcomeKey = `${voiceEnabled}:${active}:${voiceLanguage}:${spokenWelcomeEnabled}`
      if (spokenWelcomeEnabled && lastWelcomeKeyRef.current !== welcomeKey) {
        welcomeSpeakingRef.current = true
        await speak(getWelcomeMessage(voiceLanguage))
        welcomeSpeakingRef.current = false
        if (!disposed) lastWelcomeKeyRef.current = welcomeKey
      }
      if (!disposed) await startProvider()
    }

    void startWithWelcome()

    return () => {
      disposed = true
      isCleanupRef.current = true
      if (welcomeSpeakingRef.current) {
        cancelSpeech()
        welcomeSpeakingRef.current = false
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      if (providerRef.current) {
        providerRef.current.stop()
        providerRef.current = null
      }
      setIsListening(false)
      setTranscript('')
      setMicLevel(0)
    }
  }, [voiceEnabled, active, voiceLanguage, spokenWelcomeEnabled, addNotification])

  return {
    isListening,
    transcript,
    lastCommand,
    stopListening,
    micLevel,
    providerName,
    providerStatus,
    languageOptions
  }
}

// ==================== UI COMPONENT ==================== //
function VoiceController() {
  const {
    voiceEnabled,
    setVoiceEnabled,
    addNotification,
    voiceLanguage = 'english',
    setVoiceLanguage
  } = useOsStore()
  // Voice mode: 'commands' (Mode A - Web Speech API) or 'live' (Mode B - Gemini Live)
  const [voiceMode, setVoiceMode] = useState('commands')
  const {
    isListening,
    transcript,
    lastCommand,
    stopListening,
    micLevel,
    providerName,
    providerStatus,
    languageOptions
  } = useVoice(voiceMode === 'commands')
  const gemini = useGeminiVoice()
  const [showFeedback, setShowFeedback] = useState(false)
  const [ttsConfigured, setTtsConfigured] = useState(null)
  const [ttsProvider, setTtsProvider] = useState('Browser speechSynthesis')

  useEffect(() => {
    let active = true
    axios.get('/api/gnani/status', { timeout: 5000 })
      .then(({ data }) => { if (active) setTtsConfigured(Boolean(data.ttsConfigured)) })
      .catch(() => { if (active) setTtsConfigured(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (ttsConfigured !== null) {
      setTtsProvider(ttsConfigured ? 'Timbre available' : 'Browser speechSynthesis')
    }
  }, [ttsConfigured])

  useEffect(() => {
    const onTtsProvider = (event) => setTtsProvider(event.detail?.provider || 'Browser TTS')
    window.addEventListener('spiritos:tts-provider', onTtsProvider)
    return () => window.removeEventListener('spiritos:tts-provider', onTtsProvider)
  }, [])

  // Handle closing voice assistant - COMPLETE shutdown
  const handleVoiceToggle = () => {
    // Stop both modes
    stopListening()
    gemini.stop()
    setVoiceEnabled(false)
  }

  // Toggle between voice modes
  const handleModeSwitch = () => {
    if (voiceMode === 'commands') {
      // Switch to Gemini Live
      stopListening()
      setVoiceMode('live')
      gemini.start()
    } else {
      // Switch back to keyword commands
      gemini.stop()
      setVoiceMode('commands')
    }
  }

  // Show feedback popup for 3 seconds after a command
  useEffect(() => {
    if (lastCommand) {
      setShowFeedback(true)
      const t = setTimeout(() => setShowFeedback(false), 3000)
      return () => clearTimeout(t)
    }
  }, [lastCommand])

  // Show notification when Gemini Live transcript arrives
  useEffect(() => {
    if (gemini.transcriptAI) {
      addNotification(`🤖 ${gemini.transcriptAI}`, 'info')
    }
  }, [gemini.transcriptAI, addNotification])

  if (!voiceEnabled) return null

  const isLiveMode = voiceMode === 'live'
  const showLiveActive = isLiveMode && gemini.isActive

  return (
    <div className="fixed bottom-16 right-4 z-[10000] flex flex-col items-end gap-2">
      {/* ── Mode A: Command feedback toast ── */}
      <AnimatePresence>
        {!isLiveMode && showFeedback && lastCommand && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-os-bg-primary/95 backdrop-blur-lg border border-os-border rounded-xl px-4 py-3 shadow-2xl max-w-[280px]"
          >
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 text-lg">✓</span>
              <div>
                <p className="text-os-text-secondary text-[11px]">You said:</p>
                <p className="text-os-text-primary text-sm font-medium">&quot;{lastCommand.text}&quot;</p>
                {lastCommand.feedback && (
                  <p className="text-emerald-400 text-xs mt-1">{lastCommand.feedback}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mode B: Gemini Live transcript panel ── */}
      <AnimatePresence>
        {showLiveActive && (gemini.transcriptUser || gemini.transcriptAI || gemini.error) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-os-bg-primary/95 backdrop-blur-lg border border-violet-500/30 rounded-xl px-4 py-3 shadow-2xl max-w-[300px] min-w-[220px]"
          >
            {gemini.error && (
              <p className="text-red-400 text-xs mb-2">⚠ {gemini.error}</p>
            )}
            {gemini.transcriptUser && (
              <div className="mb-2">
                <p className="text-os-text-secondary text-[10px] uppercase tracking-wider">You</p>
                <p className="text-os-text-primary text-sm">{gemini.transcriptUser}</p>
              </div>
            )}
            {gemini.transcriptAI && (
              <div>
                <p className="text-violet-400 text-[10px] uppercase tracking-wider">IRIS</p>
                <p className="text-os-text-primary text-sm">{gemini.transcriptAI}</p>
              </div>
            )}
            {gemini.lastTool && gemini.lastTool.status === 'running' && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                <span className="text-amber-400 text-[10px]">Running tool...</span>
              </div>
            )}
            {gemini.lastTool && gemini.lastTool.status === 'done' && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-emerald-400 text-[10px]">✓ {gemini.lastTool.tool}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mode A: Listening indicator with mic level ── */}
      <AnimatePresence>
        {!isLiveMode && voiceEnabled && isListening && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-emerald-600/90 backdrop-blur-md text-white text-sm px-4 py-2 rounded-xl shadow-lg flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Listening... say a command
            </div>
            {providerName === 'Gnani Prisma' && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] opacity-70">MIC</span>
                <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-75"
                    style={{
                      width: `${Math.min(100, micLevel * 3)}%`,
                      backgroundColor: micLevel < 2 ? '#ef4444' : micLevel < 10 ? '#f59e0b' : '#4ade80'
                    }}
                  />
                </div>
                <span className="text-[10px] opacity-70 w-6 text-right">{micLevel}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mode B: Gemini Live active indicator ── */}
      <AnimatePresence>
        {showLiveActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-violet-600/90 backdrop-blur-md text-white text-sm px-4 py-2 rounded-xl shadow-lg flex items-center gap-2"
          >
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            {gemini.isReady ? 'IRIS Live — speak naturally' : 'Connecting to IRIS...'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Live transcript (Mode A) ── */}
      <AnimatePresence>
        {!isLiveMode && voiceEnabled && transcript && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-os-surface/90 backdrop-blur-md text-os-text-secondary text-xs px-3 py-1.5 rounded-lg max-w-[250px] truncate"
          >
            🎤 {transcript}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mode switch button ── */}
      <motion.button
        onClick={handleModeSwitch}
        className={`px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase transition-all border ${
          isLiveMode
            ? 'bg-violet-500/20 text-violet-300 border-violet-500/30 hover:bg-violet-500/30'
            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title={isLiveMode ? 'Switch to keyword commands' : 'Switch to IRIS Live conversation'}
      >
        {isLiveMode ? '🔮 Live Mode' : '🎤 Commands'}
      </motion.button>

      {/* ── Main mic button ── */}
      <motion.button
        onClick={handleVoiceToggle}
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
          showLiveActive
            ? 'bg-violet-500 ring-2 ring-violet-300 ring-offset-2 ring-offset-os-bg-primary'
            : isListening
              ? 'bg-emerald-500 ring-2 ring-emerald-300 ring-offset-2 ring-offset-os-bg-primary'
              : 'bg-emerald-500/70'
        }`}
        animate={voiceEnabled ? { scale: [1, 1.06, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.5 }}
        title="Click to close voice assistant"
      >
        <span className="text-xl">{isLiveMode ? '🔮' : '🎤'}</span>
      </motion.button>

      {/* ── Status text ── */}
      <span className={`text-[10px] ${
        showLiveActive ? 'text-violet-400'
          : isListening ? 'text-emerald-400'
            : 'text-os-text-secondary'
      }`}>
        {showLiveActive
          ? (gemini.isReady ? 'IRIS Live' : 'Connecting...')
          : isListening
            ? 'Listening...'
            : providerStatus === 'connecting'
              ? 'Connecting...'
              : providerStatus === 'error'
                ? 'Check microphone'
            : 'Voice off'}
      </span>

      <div className="flex items-center gap-2">
        {!isLiveMode && (
          <label className="sr-only" htmlFor="voice-language">Voice language</label>
        )}
        {!isLiveMode && (
          <select
            id="voice-language"
            aria-label="Voice language"
            value={voiceLanguage}
            onChange={(event) => setVoiceLanguage(event.target.value)}
            className="max-w-[150px] rounded-lg border border-white/20 bg-os-bg-primary/95 px-2 py-1 text-[10px] text-os-text-primary"
          >
            {languageOptions.map((language) => (
              <option key={language.id} value={language.id}>{language.label}</option>
            ))}
          </select>
        )}
        <span className="rounded-full border border-white/15 bg-os-bg-primary/90 px-2 py-1 text-[9px] text-os-text-secondary">
          Voice by {isLiveMode ? gemini.speechProvider : providerName} / {ttsProvider}
        </span>
      </div>
      {!isLiveMode && providerStatus === 'error' && (
        <span role="status" className="text-[10px] text-red-300">Check microphone access and voice service.</span>
      )}
    </div>
  )
}

export default VoiceController
export { useVoice }
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

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useOsStore from '../store/osStore'
import useWindowStore from '../store/windowStore'
import useChatStore from '../store/chatStore'
import { getDefaultSize } from '../config/appConfig'
import { speak } from '../hooks/useTTS'
import { parseIntent, executeIntent } from './voiceIntents'
import useGeminiVoice from '../hooks/useGeminiVoice'
import axios from 'axios'

// Wake word removed: when voice is enabled, every transcript is treated as a command.
const SILENCE_DEBOUNCE_MS = 1200

const SITE_MAP = [
  { key: 'youtube', url: 'https://www.youtube.com' },
  { key: 'yt', url: 'https://www.youtube.com' },
  { key: 'google', url: 'https://www.google.com' },
  { key: 'gmail', url: 'https://mail.google.com' },
  { key: 'github', url: 'https://github.com' },
  { key: 'reddit', url: 'https://www.reddit.com' },
  { key: 'spotify', url: 'https://open.spotify.com' },
  { key: 'netflix', url: 'https://www.netflix.com' },
  { key: 'linkedin', url: 'https://www.linkedin.com' }
]

const APP_KEYWORDS = [
  { key: 'file explorer', app: 'FileExplorer' },
  { key: 'files', app: 'FileExplorer' },
  { key: 'explorer', app: 'FileExplorer' },
  { key: 'calculator', app: 'Calculator' },
  { key: 'calc', app: 'Calculator' },
  { key: 'terminal', app: 'Terminal' },
  { key: 'command prompt', app: 'Terminal' },
  { key: 'cmd', app: 'Terminal' },
  { key: 'notes', app: 'Notes' },
  { key: 'notepad', app: 'Notes' },
  { key: 'browser', app: 'Browser' },
  { key: 'chrome', app: 'Browser' },
  { key: 'settings', app: 'Settings' },
  { key: 'translator', app: 'Translator' },
  { key: 'translate', app: 'Translator' }
]

// ==================== COMMAND REGISTRY ==================== //
// Each entry: [keywords[], action, spoken feedback]
const COMMANDS = [
  // --- Presentation (only effective when a deck is playing) ---
  { match: ['next slide', 'next', 'forward'],
    action: () => window.dispatchEvent(new CustomEvent('spiritos:presentation', { detail: { cmd: 'next' } })),
    feedback: 'Next slide', presentationOnly: true },
  { match: ['previous slide', 'previous', 'back', 'go back'],
    action: () => window.dispatchEvent(new CustomEvent('spiritos:presentation', { detail: { cmd: 'prev' } })),
    feedback: 'Previous slide', presentationOnly: true },
  { match: ['read this', 'read it', 'read aloud', 'read slide'],
    action: () => window.dispatchEvent(new CustomEvent('spiritos:presentation', { detail: { cmd: 'read' } })),
    feedback: 'Reading aloud', presentationOnly: true },
  { match: ['play presentation', 'auto play', 'autoplay', 'pause presentation'],
    action: () => window.dispatchEvent(new CustomEvent('spiritos:presentation', { detail: { cmd: 'toggle' } })),
    feedback: 'Toggled auto-play', presentationOnly: true },
  { match: ['stop presentation', 'close slides', 'exit slides'],
    action: () => window.dispatchEvent(new CustomEvent('spiritos:presentation', { detail: { cmd: 'close' } })),
    feedback: 'Closing presentation', presentationOnly: true },

  // --- App launching ---
  { match: ['open file explorer', 'open files', 'open explorer', 'file manager', 'my files'],
    action: (ctx) => ctx.openApp('FileExplorer'), feedback: 'Opening File Explorer' },
  { match: ['open calculator', 'calculator', 'calc'],
    action: (ctx) => ctx.openApp('Calculator'), feedback: 'Opening Calculator' },
  { match: ['open terminal', 'terminal', 'command prompt', 'cmd'],
    action: (ctx) => ctx.openApp('Terminal'), feedback: 'Opening Terminal' },
  { match: ['open notes', 'notes', 'notepad', 'open notepad'],
    action: (ctx) => ctx.openApp('Notes'), feedback: 'Opening Notes' },
  { match: ['open browser', 'browser', 'open internet', 'internet', 'web browser'],
    action: (ctx) => ctx.openApp('Browser'), feedback: 'Opening Browser' },
  { match: ['open settings', 'settings', 'preferences', 'system settings'],
    action: (ctx) => ctx.openApp('Settings'), feedback: 'Opening Settings' },
  { match: ['open translator', 'translator', 'translate'],
    action: (ctx) => ctx.openApp('Translator'), feedback: 'Opening Translator' },
  { match: ['open presentations', 'presentations', 'open slides', 'show slides', 'open presentation'],
    action: (ctx) => ctx.openApp('Presentation'), feedback: 'Opening Presentations' },
  { match: ['open reminders', 'reminders', 'show reminders', 'my reminders'],
    action: (ctx) => ctx.openApp('Reminders'), feedback: 'Opening Reminders' },
  { match: ['open contacts', 'sos contacts', 'emergency contacts'],
    action: (ctx) => ctx.openApp('Emergency'), feedback: 'Opening SOS Contacts' },

  // --- Window management ---
  { match: ['close window', 'close this', 'close app', 'close it'],
    action: (ctx) => ctx.closeActive(), feedback: 'Window closed' },
  { match: ['close all', 'close everything', 'close all windows'],
    action: (ctx) => ctx.closeAll(), feedback: 'All windows closed' },
  { match: ['minimize window', 'minimize this', 'minimize', 'hide window', 'hide this'],
    action: (ctx) => ctx.minimizeActive(), feedback: 'Window minimized' },
  { match: ['maximize window', 'maximize this', 'maximize', 'full screen', 'fullscreen'],
    action: (ctx) => ctx.maximizeActive(), feedback: 'Window maximized' },
  { match: ['show desktop', 'go to desktop', 'desktop', 'go home', 'home'],
    action: (ctx) => ctx.showDesktop(), feedback: 'Showing desktop' },

  // --- Accessibility ---
  { match: ['zoom in', 'make bigger', 'increase size', 'larger text'],
    action: (ctx) => ctx.zoomIn(), feedback: 'Zoomed in' },
  { match: ['zoom out', 'make smaller', 'decrease size', 'smaller text'],
    action: (ctx) => ctx.zoomOut(), feedback: 'Zoomed out' },
  { match: ['normal zoom', 'reset zoom', 'default size', 'normal size'],
    action: (ctx) => ctx.zoomReset(), feedback: 'Zoom reset to normal' },

  // --- System ---
  { match: ['what time is it', 'time', 'current time', 'tell me the time', 'what is the time'],
    action: (ctx) => ctx.tellTime(), feedback: null },
  { match: ['what date is it', 'date', 'today date', "today's date", 'what day is it'],
    action: (ctx) => ctx.tellDate(), feedback: null },
  { match: ['battery', 'battery status', 'battery level', 'how much battery'],
    action: (ctx) => ctx.tellBattery(), feedback: null },
  { match: ['mute', 'mute audio', 'mute sound', 'silence'],
    action: (ctx) => ctx.toggleMute(true), feedback: 'Audio muted' },
  { match: ['unmute', 'unmute audio', 'sound on', 'unmute sound'],
    action: (ctx) => ctx.toggleMute(false), feedback: 'Audio unmuted' },
  { match: ['refresh', 'reload', 'restart'],
    action: () => window.location.reload(), feedback: 'Refreshing...' },

  // --- Navigation ---
  { match: ['scroll down', 'go down', 'page down'],
    action: () => window.scrollBy(0, 300), feedback: 'Scrolling down' },
  { match: ['scroll up', 'go up', 'page up'],
    action: () => window.scrollBy(0, -300), feedback: 'Scrolling up' },

  // --- Help ---
  { match: ['help', 'what can you do', 'commands', 'voice commands', 'list commands'],
    action: (ctx) => ctx.speakHelp(), feedback: null },
  { match: ['help me', 'show help', 'open help', 'welcome tour', 'tour'],
    action: (ctx) => ctx.openHelpTour(), feedback: 'Opening help tour' },
  { match: ['call for help', 'emergency', 'call emergency', 'call sos', 'sos'],
    action: (ctx) => ctx.triggerSOS(), feedback: 'Triggering SOS' },
  { match: ['thank you', 'thanks', 'good job'],
    action: () => {}, feedback: "You're welcome!" },
  { match: ['hello', 'hi', 'hey'],
    action: () => {}, feedback: 'Hello! How can I help you?' },
]

// ==================== FUZZY MATCHER ==================== //
function findCommand(input, presentationActive = false) {
  const normalized = input.toLowerCase().trim()
  if (!normalized) return null

  const candidates = COMMANDS.filter((c) => !c.presentationOnly || presentationActive)

  // 1. Exact match
  for (const cmd of candidates) {
    if (cmd.match.some(m => normalized === m)) return cmd
  }

  // 2. Contains match (input contains a command phrase)
  for (const cmd of candidates) {
    if (cmd.match.some(m => normalized.includes(m))) return cmd
  }

  // 3. Fuzzy: check if most words of a command exist in input
  for (const cmd of candidates) {
    for (const phrase of cmd.match) {
      const phraseWords = phrase.split(' ')
      const inputWords = normalized.split(' ')
      const matchCount = phraseWords.filter(w => inputWords.some(iw => iw.includes(w) || w.includes(iw))).length
      if (matchCount >= Math.ceil(phraseWords.length * 0.7)) return cmd
    }
  }

  return null
}

function resolveAppFromText(text) {
  const normalized = text.toLowerCase()
  const sorted = [...APP_KEYWORDS].sort((a, b) => b.key.length - a.key.length)
  const match = sorted.find(item => normalized.includes(item.key))
  return match ? match.app : null
}

function resolveUrlFromText(text) {
  const normalized = text.toLowerCase()
  const site = SITE_MAP.find(item => normalized.includes(item.key))
  if (site) return site.url

  const urlMatch = normalized.match(/\b(https?:\/\/\S+|\S+\.\S{2,})\b/)
  if (urlMatch) {
    const raw = urlMatch[1]
    return raw.startsWith('http') ? raw : `https://${raw}`
  }

  return null
}

// ==================== VOICE HOOK ==================== //
function useVoice(active = true) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [lastCommand, setLastCommand] = useState(null) // { text, feedback, time }
  const recognitionRef = useRef(null)
  const retryCount = useRef(0)
  const restartTimer = useRef(null)
  const silenceTimerRef = useRef(null)
  const lastHeardRef = useRef('')
  const lastExecutedRef = useRef('')
  const lastExecutedAtRef = useRef(0)
  const isCleanupRef = useRef(false) // Track if we're cleaning up
  const isProcessingRef = useRef(false)
  const [micLevel, setMicLevel] = useState(0) // 0-100 audio level for diagnostics
  const audioContextRef = useRef(null)
  const micStreamRef = useRef(null)

  const { voiceEnabled, voiceLocale = 'en-US', addNotification } = useOsStore()

  // Use ref to always get current voiceEnabled value in callbacks
  const voiceEnabledRef = useRef(voiceEnabled && active)
  useEffect(() => { voiceEnabledRef.current = voiceEnabled && active }, [voiceEnabled, active])

  // Force stop listening - can be called externally
  const stopListening = useCallback(() => {
    isCleanupRef.current = true
    voiceEnabledRef.current = false

    // Clear all timers
    if (restartTimer.current) {
      clearTimeout(restartTimer.current)
      restartTimer.current = null
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    // Stop recognition completely
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    // Reset state
    setIsListening(false)
    setTranscript('')
    retryCount.current = 99
  }, [])

  // Build command context — uses getState() for fresh store at execution time
  const buildContext = useCallback(() => {
    return {
      openApp: (name) => {
        console.log('[Voice] Opening app:', name)
        useWindowStore.getState().openWindow(name, name, getDefaultSize(name))
      },

      closeApp: (name) => {
        const { windows, closeWindow } = useWindowStore.getState()
        const target = windows.find(w => w.app === name && !w.minimized) || windows.find(w => w.app === name)
        if (target) closeWindow(target.id)
      },

      openUrl: (url) => {
        if (!url) return
        window.open(url, '_blank', 'noopener,noreferrer')
      },

      searchWeb: (query) => {
        if (!query) return
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
        window.open(url, '_blank', 'noopener,noreferrer')
      },

      playOnYouTube: (query) => {
        if (!query) return
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
        window.open(url, '_blank', 'noopener,noreferrer')
      },

      closeActive: () => {
        const { windows, closeWindow } = useWindowStore.getState()
        const focused = windows.find(w => w.focused)
        if (focused) closeWindow(focused.id)
      },

      closeAll: () => {
        const { windows, closeWindow } = useWindowStore.getState()
        windows.forEach(w => closeWindow(w.id))
      },

      minimizeActive: () => {
        const { windows, minimizeWindow } = useWindowStore.getState()
        const focused = windows.find(w => w.focused)
        if (focused) minimizeWindow(focused.id)
      },

      maximizeActive: () => {
        const { windows, maximizeWindow } = useWindowStore.getState()
        const focused = windows.find(w => w.focused)
        if (focused) maximizeWindow(focused.id)
      },

      showDesktop: () => {
        const { windows, minimizeWindow } = useWindowStore.getState()
        windows.forEach(w => minimizeWindow(w.id))
      },

      zoomIn: () => {
        const current = parseFloat(document.documentElement.style.fontSize || '100')
        document.documentElement.style.fontSize = Math.min(current + 25, 200) + '%'
      },

      zoomOut: () => {
        const current = parseFloat(document.documentElement.style.fontSize || '100')
        document.documentElement.style.fontSize = Math.max(current - 25, 75) + '%'
      },

      zoomReset: () => {
        document.documentElement.style.fontSize = '100%'
      },

      tellTime: () => {
        const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        speak(`The time is ${t}`)
      },

      tellDate: () => {
        const d = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        speak(`Today is ${d}`)
      },

      tellBattery: () => {
        if ('getBattery' in navigator) {
          navigator.getBattery().then(b => {
            speak(`Battery is at ${Math.round(b.level * 100)} percent${b.charging ? ', and charging' : ''}`)
          })
        } else {
          speak('Battery information is not available')
        }
      },

      toggleMute: (mute) => {
        document.querySelectorAll('audio, video').forEach(el => { el.muted = mute })
      },

      speakHelp: () => {
        speak('You can say: Open calculator, close window, minimize, maximize, show desktop, zoom in, zoom out, what time is it, or help.')
      },

      translateText: (text, targetLang, sourceLang) => {
        if (!text) return
        useWindowStore.getState().openWindow('Translator', 'Translator', getDefaultSize('Translator'))
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('spiritos:translate', {
            detail: { text, targetLang, sourceLang }
          }))
        }, 150)
      },

      setTheme: (theme) => useOsStore.getState().setTheme(theme),
      setFontSize: (size) => useOsStore.getState().setFontSize(size),
      getFontSize: () => useOsStore.getState().fontSize,
      setFontWeight: (weight) => useOsStore.getState().setFontWeight(weight),
      getFontWeight: () => useOsStore.getState().fontWeight,

      // Help: open the welcome presentation
      openHelpTour: async () => {
        try {
          const r = await fetch('/api/presentations')
          const list = await r.json()
          const welcome = (list || []).find((d) => d.isBuiltin && /welcome/i.test(d.title))
          useWindowStore.getState().openWindow(
            'Presentation', 'Welcome tour', getDefaultSize('Presentation'),
            welcome ? { initialDeckId: welcome.id } : {}
          )
        } catch (_) {
          useWindowStore.getState().openWindow('Presentation', 'Presentations', getDefaultSize('Presentation'))
        }
      },

      // SOS: dial primary contact via tel: link (with cancellable countdown)
      triggerSOS: async () => {
        try {
          const r = await fetch('/api/emergency')
          const list = await r.json()
          if (!list?.length) {
            speak('You have no emergency contacts. Please add one in SOS Contacts.')
            useWindowStore.getState().openWindow('Emergency', 'SOS Contacts', getDefaultSize('Emergency'))
            return
          }
          // Hand off to the global SOSButton component which shows the
          // cancellable countdown overlay before actually dialling.
          window.dispatchEvent(new CustomEvent('spiritos:sos'))
        } catch (err) {
          speak('Could not reach the emergency service. Please open SOS Contacts.')
        }
      }
    }
  }, [])

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

  function executeAgentAction(action) {
    if (!action) return

    const windowStore = useWindowStore.getState()
    const osState = useOsStore.getState()

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
        // Forward to the reminders API directly. We deliberately don't await
        // here — the assistant's spoken reply already confirms the intent.
        if (action.title && /^\d{2}:\d{2}$/.test(action.timeOfDay || '')) {
          axios.post('/api/reminders', {
            title:      action.title,
            timeOfDay:  action.timeOfDay,
            daysMask:   '1111111',
            enabled:    true,
            speakAloud: true
          }).catch((err) => console.warn('[Voice] createReminder failed:', err.message))
        }
        break
      case 'deleteReminder':
        axios.get('/api/reminders').then(({ data }) => {
          const needle = (action.match || '').toLowerCase()
          const target = needle
            ? (data || []).find((r) => r.title.toLowerCase().includes(needle))
            : (data || [])[0]
          if (target) return axios.delete(`/api/reminders/${target.id}`)
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
      case 'openHelpTour':
        // Open the welcome presentation
        windowStore.openWindow('Presentation', 'Welcome tour', getDefaultSize('Presentation'))
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
  }

  async function runAgentFallback(commandText) {
    try {
      // Build OS state snapshot + recent voice conversation history so the
      // LLM has context across utterances.
      const recent = useChatStore.getState().recent(6)
      const osState = {
        ...buildOsStateForAgent(),
        sessionHistory: recent
      }

      // Push the user turn into chat history before the request so the
      // server-side prompt sees it.
      useChatStore.getState().push('user', commandText)

      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commandText, osState })
      })

      if (!response.ok) {
        throw new Error(`Agent request failed (${response.status})`)
      }

      const data = await response.json()
      if (data.action) executeAgentAction(data.action)

      const agents = data.agents || []
      if (agents.some(a => a && a.includes('reminder'))) {
        window.dispatchEvent(new CustomEvent('spiritos:reminders-changed'))
      }

      if (data.message) {
        useChatStore.getState().push('assistant', data.message)
        speak(data.message)
        addNotification(`🤖 ${data.message}`, 'info')
        setLastCommand({ text: commandText, feedback: data.message, time: Date.now() })
      }

      return true
    } catch (err) {
      console.warn('[Voice] AI fallback failed:', err.message)
      speak(`I couldn't reach the assistant. ${err.message || 'Please try again.'}`)
      return false
    }
  }

  function handleDirectIntent(commandText, ctx) {
    const normalized = commandText.toLowerCase().trim()

    const cleaned = normalized.replace(/\b(in|using)\s+translator\b/g, '').trim()
    const translateMatch = cleaned.match(/\btranslate\s+(.+?)\s+(?:to|into|in)\s+([a-z\s-]+)\b/)
    const translateAlt = cleaned.match(/\btranslate\s+(?:to|into|in)\s+([a-z\s-]+)[,:]?\s+(.+)/)
    if (translateMatch || translateAlt) {
      const phrase = (translateMatch ? translateMatch[1] : translateAlt[2]).trim()
      let target = (translateMatch ? translateMatch[2] : translateAlt[1]).trim()
      target = target.replace(/\b(language|lang|translator)\b/g, '').trim()
      const isAny = /\bany\b/.test(target)
      const targetLang = (!target || isAny) ? null : target

      if (phrase) {
        ctx.translateText(phrase, targetLang)
        speak(targetLang ? `Translating to ${targetLang}` : 'Opening translator')
        return true
      }
    }

    const themeMatch =
      normalized.match(/\b(dark|light)\s+(?:mode|theme)\b/) ||
      normalized.match(/\b(?:set|change|switch)\s+(?:theme|mode)?\s*(?:to)?\s*(dark|light)\b/)
    if (themeMatch) {
      const theme = themeMatch[1]
      ctx.setTheme(theme)
      speak(`Theme set to ${theme}`)
      return true
    }

    const sizeOrder = ['normal', 'large', 'xl']
    const weightOrder = ['normal', 'medium', 'bold']
    const sizeMap = {
      normal: 'normal',
      default: 'normal',
      large: 'large',
      big: 'large',
      bigger: 'large',
      xl: 'xl',
      'extra large': 'xl',
      'extra-large': 'xl'
    }
    const weightMap = {
      normal: 'normal',
      regular: 'normal',
      medium: 'medium',
      bold: 'bold',
      semibold: 'bold',
      heavy: 'bold'
    }

    const adjustInList = (list, current, delta) => {
      const index = list.indexOf(current)
      const safeIndex = index === -1 ? 0 : index
      const nextIndex = Math.max(0, Math.min(list.length - 1, safeIndex + delta))
      return list[nextIndex]
    }

    let sizeChanged = null
    let weightChanged = null

    const sizeExplicitMatch = normalized.match(/\b(?:font|text)\s*size\s*(?:to)?\s*(normal|default|large|xl|extra large|extra-large|big|bigger)\b/)
    if (sizeExplicitMatch) {
      const requested = sizeMap[sizeExplicitMatch[1]] || 'normal'
      ctx.setFontSize(requested)
      sizeChanged = requested
    } else if (/\b(increase|bigger|larger|boost|raise)\b.*\b(font|text)\b.*\bsize\b/.test(normalized)) {
      const next = adjustInList(sizeOrder, ctx.getFontSize(), 1)
      ctx.setFontSize(next)
      sizeChanged = next
    } else if (/\b(decrease|smaller|reduce|lower)\b.*\b(font|text)\b.*\bsize\b/.test(normalized)) {
      const next = adjustInList(sizeOrder, ctx.getFontSize(), -1)
      ctx.setFontSize(next)
      sizeChanged = next
    }

    const weightExplicitMatch = normalized.match(/\b(?:font|text)\s*weight\s*(?:to)?\s*(normal|regular|medium|bold|semibold|heavy)\b/)
    if (weightExplicitMatch) {
      const requested = weightMap[weightExplicitMatch[1]] || 'normal'
      ctx.setFontWeight(requested)
      weightChanged = requested
    } else if (/\bmake\s+(?:text|font)\s+bold\b/.test(normalized) || /\bbold\s+(?:text|font)\b/.test(normalized)) {
      ctx.setFontWeight('bold')
      weightChanged = 'bold'
    } else if (/\bmake\s+(?:text|font)\s+normal\b/.test(normalized)) {
      ctx.setFontWeight('normal')
      weightChanged = 'normal'
    } else if (/\b(increase|boost|raise|bolder|heavier)\b.*\b(font|text)\b.*\bweight\b/.test(normalized)) {
      const next = adjustInList(weightOrder, ctx.getFontWeight(), 1)
      ctx.setFontWeight(next)
      weightChanged = next
    } else if (/\b(decrease|reduce|lower|lighter)\b.*\b(font|text)\b.*\bweight\b/.test(normalized) || /\bmake\s+(?:text|font)\s+lighter\b/.test(normalized)) {
      const next = adjustInList(weightOrder, ctx.getFontWeight(), -1)
      ctx.setFontWeight(next)
      weightChanged = next
    }

    if (sizeChanged || weightChanged) {
      const feedback = []
      if (sizeChanged) feedback.push(`Font size set to ${sizeChanged}`)
      if (weightChanged) feedback.push(`Font weight set to ${weightChanged}`)
      speak(feedback.join(' and '))
      return true
    }

    const playMatch = normalized.match(/\bplay\s+(.+?)\s+(?:on\s+)?(youtube|yt)\b/)
    if (playMatch) {
      const query = playMatch[1]
      ctx.playOnYouTube(query)
      speak(`Playing ${query} on YouTube`)
      return true
    }

    const searchMatch = normalized.match(/\b(?:search for|search|google)\s+(.+)/)
    if (searchMatch) {
      ctx.searchWeb(searchMatch[1])
      speak(`Searching for ${searchMatch[1]}`)
      return true
    }

    if (normalized.startsWith('open ') || normalized.startsWith('visit ') || normalized.startsWith('go to ')) {
      const app = resolveAppFromText(normalized)
      if (app) {
        ctx.openApp(app)
        speak(`Opening ${app}`)
        return true
      }

      const url = resolveUrlFromText(normalized)
      if (url) {
        ctx.openUrl(url)
        speak('Opening website')
        return true
      }
    }

    if (normalized.startsWith('close ') || normalized.startsWith('exit ') || normalized.startsWith('quit ')) {
      const app = resolveAppFromText(normalized)
      if (app) {
        ctx.closeApp(app)
        speak(`Closing ${app}`)
        return true
      }
    }

    return false
  }

  // Execute a recognized command
  const executeCommand = useCallback(async (commandText) => {
    const ctx = buildContext()

    // ── 1. Try the new intent parser first.
    // Handles reminders, alarms, SOS, theme, font size, profile, search,
    // window control, presentation nav, and more — all with proper
    // argument extraction.
    const intent = parseIntent(commandText)
    if (intent) {
      try {
        const feedback = await executeIntent(intent, {
          openApp: ctx.openApp,
          closeActive: ctx.closeActive,
          closeAll: ctx.closeAll,
          minimizeActive: ctx.minimizeActive,
          maximizeActive: ctx.maximizeActive,
          showDesktop: ctx.showDesktop,
          focusNext: () => useWindowStore.getState().focusNextWindow(),
          focusPrev: () => useWindowStore.getState().focusPrevWindow(),
          speakOut: speak,
          addNotification,
          setTheme: ctx.setTheme,
          setFontSize: ctx.setFontSize,
          applyProfile: (p) => useOsStore.getState().applyProfile(p),
          closeAppByName: ctx.closeApp,
          presentationDispatch: (cmd) =>
            window.dispatchEvent(new CustomEvent('spiritos:presentation', { detail: { cmd } })),
          googleSearch: ctx.searchWeb,
          openYouTube: ctx.playOnYouTube,
          openHelpTour: ctx.openHelpTour,
          listVoiceCommands: ctx.speakHelp,
          triggerSOS: ctx.triggerSOS
        })
        if (feedback) {
          speak(feedback)
          addNotification(`🎤 ${feedback}`, 'success')
          setLastCommand({ text: commandText, feedback, time: Date.now() })
        }
        return true
      } catch (err) {
        console.warn('[Voice] Intent execution failed:', err)
      }
    }

    // ── 2. Fall through to the legacy direct-intent helpers (translation,
    //       very specific font size phrasing) and the old keyword matcher.
    if (handleDirectIntent(commandText, ctx)) return true

    const presentationActive = useOsStore.getState().presentationActive
    const cmd = findCommand(commandText, presentationActive)
    if (cmd) {
      cmd.action(ctx)
      const fb = cmd.feedback || ''
      if (fb) speak(fb)
      setLastCommand({ text: commandText, feedback: fb, time: Date.now() })
      addNotification(`🎤 "${commandText}" → ${fb || 'Done'}`, 'success')
      return true
    }

    const aiHandled = await runAgentFallback(commandText)
    if (aiHandled) return true

    speak(`Sorry, I didn't understand "${commandText}". Say "help" for available commands.`)
    setLastCommand({ text: commandText, feedback: 'Not understood', time: Date.now() })
    addNotification(`🎤 "${commandText}" — command not recognized`, 'warning')
    return false
  }, [buildContext, addNotification])

  function executeIfNew(text) {
    const trimmed = text.trim()
    if (!trimmed) return

    const now = Date.now()
    if (lastExecutedRef.current === trimmed && (now - lastExecutedAtRef.current) < 2500) {
      return
    }

    // Stop recognition to reset session & clear event.results
    isProcessingRef.current = true
    setIsListening(false)
    try { recognitionRef.current.stop() } catch {}

    void executeCommand(trimmed).then((handled) => {
      isProcessingRef.current = false
      if (handled) {
        setTranscript('')
        lastExecutedRef.current = trimmed
        lastExecutedAtRef.current = now
      }
      // Restart recognition if still enabled and not cleaned up
      if (voiceEnabledRef.current && !isCleanupRef.current) {
        try { recognitionRef.current.start() } catch {}
      }
    })
  }

  function queueCommand(text, source) {
    lastHeardRef.current = text

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)

    // Debounce both interim and final results to wait for silence
    silenceTimerRef.current = setTimeout(() => {
      executeIfNew(lastHeardRef.current)
    }, SILENCE_DEBOUNCE_MS)
  }

  // Speech recognition setup - single unified effect
  useEffect(() => {
    console.log('[VoiceHook] useEffect fired — voiceEnabled:', voiceEnabled, 'active:', active)
    // If voice is disabled or we're not active, don't start anything
    if (!voiceEnabled || !active) {
      console.log('[VoiceHook] Skipping — voiceEnabled:', voiceEnabled, 'active:', active)
      return
    }
    isCleanupRef.current = false

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
    if (!SpeechRecognition) {
      console.warn('[VoiceHook] SpeechRecognition API not supported in this browser')
      return
    }
    console.log('[VoiceHook] SpeechRecognition API found, creating instance...')

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = voiceLocale

    recognition.onresult = (event) => {
      if (isCleanupRef.current) return // Ignore results during cleanup

      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = 0; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += text
        } else {
          interimTranscript += text
        }
      }

      const full = (finalTranscript + ' ' + interimTranscript).trim()
      if (full) setTranscript(full)

      if (finalTranscript.trim()) {
        queueCommand(finalTranscript.trim(), 'final')
      } else if (interimTranscript.trim()) {
        queueCommand(interimTranscript.trim(), 'interim')
      }
    }

    recognition.onspeechend = () => {
      if (isCleanupRef.current) return
      if (lastHeardRef.current) {
        executeIfNew(lastHeardRef.current)
      }
    }

    recognition.onnomatch = () => {
      if (!isCleanupRef.current) {
        addNotification('🎤 I did not catch that. Please try again.', 'warning')
      }
    }

    recognition.onstart = () => {
      console.log('[VoiceHook] recognition.onstart fired')
      if (!isCleanupRef.current) {
        setIsListening(true)
        retryCount.current = 0
      }
    }

    recognition.onend = () => {
      console.log('[VoiceHook] recognition.onend fired — cleanup:', isCleanupRef.current, 'processing:', isProcessingRef.current, 'voiceEnabled:', voiceEnabledRef.current, 'retries:', retryCount.current)
      if (isCleanupRef.current) return // Don't restart during cleanup

      // Only auto-restart if voice is still enabled and we're not processing a command
      if (voiceEnabledRef.current && !isProcessingRef.current && retryCount.current < 5) {
        console.log('[VoiceHook] Scheduling restart in 300ms...')
        restartTimer.current = setTimeout(() => {
          console.log('[VoiceHook] Restarting recognition...')
          try { recognition.start() } catch (err) {
            console.error('[VoiceHook] Restart failed:', err)
            setIsListening(false)
          }
        }, 300)
      } else {
        console.log('[VoiceHook] NOT restarting — setting isListening=false')
        setIsListening(false)
      }
    }

    recognition.onerror = (e) => {
      console.warn('[VoiceHook] recognition.onerror:', e.error)
      if (isCleanupRef.current) return

      if (e.error === 'network') {
        retryCount.current++
        return
      }
      if (e.error === 'audio-capture' || e.error === 'not-allowed') {
        console.error('[VoiceHook] FATAL — mic denied or audio-capture failed')
        if (retryCount.current === 0) {
          addNotification('🎤 Microphone access denied — please allow microphone in your browser to use voice commands', 'error')
        }
        retryCount.current = 99
        return
      }
      if (e.error === 'no-speech' || e.error === 'aborted') return
      console.warn('[VoiceHook] Unknown speech error:', e.error)
    }

    // Store and start
    recognitionRef.current = recognition

    // Request mic permission and start
    console.log('[VoiceHook] Requesting mic permission via getUserMedia...')
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        console.log('[VoiceHook] Mic permission granted, got', stream.getTracks().length, 'tracks')

        // ── Mic audio level diagnostic ──
        // Keep stream alive to monitor audio levels and prove mic is working
        micStreamRef.current = stream
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
          audioContextRef.current = audioCtx
          const source = audioCtx.createMediaStreamSource(stream)
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)
          const dataArray = new Uint8Array(analyser.frequencyBinCount)

          let peakLevel = 0
          const checkLevel = () => {
            if (isCleanupRef.current) return
            analyser.getByteFrequencyData(dataArray)
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
            const level = Math.round((avg / 255) * 100)
            if (level > peakLevel) peakLevel = level
            setMicLevel(level)
            requestAnimationFrame(checkLevel)
          }
          checkLevel()

          // After 3 seconds, report mic diagnostic
          setTimeout(() => {
            if (!isCleanupRef.current) {
              if (peakLevel < 2) {
                console.error('[VoiceHook] ⚠ MIC DIAGNOSTIC: No audio detected! Peak level:', peakLevel, '— mic may be muted or wrong device selected')
                addNotification('⚠️ Microphone is not picking up any sound — check that the correct mic is selected and not muted', 'error')
              } else {
                console.log('[VoiceHook] ✅ MIC DIAGNOSTIC: Audio detected. Peak level:', peakLevel)
              }
            }
          }, 3000)
        } catch (audioErr) {
          console.warn('[VoiceHook] Audio level monitoring failed:', audioErr)
          // Non-critical — still proceed with speech recognition
          stream.getTracks().forEach(t => t.stop())
        }

        if (!isCleanupRef.current) {
          console.log('[VoiceHook] Starting recognition...')
          try {
            recognition.start()
            console.log('[VoiceHook] recognition.start() called successfully')
          } catch (err) {
            console.error('[VoiceHook] recognition.start() threw:', err)
          }
        } else {
          console.log('[VoiceHook] Cleanup happened before start — skipping')
        }
      })
      .catch((err) => {
        console.error('[VoiceHook] getUserMedia FAILED:', err)
        if (!isCleanupRef.current) {
          addNotification('🎤 Microphone access denied — please allow mic in browser settings', 'error')
        }
      })

    // Cleanup
    return () => {
      isCleanupRef.current = true
      if (restartTimer.current) clearTimeout(restartTimer.current)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      try { recognition.stop() } catch {}
      // Clean up audio monitoring
      if (audioContextRef.current) {
        try { audioContextRef.current.close() } catch {}
        audioContextRef.current = null
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop())
        micStreamRef.current = null
      }
      setIsListening(false)
      setTranscript('')
      setMicLevel(0)
    }
  }, [voiceEnabled, active, voiceLocale, addNotification])

  return { isListening, transcript, lastCommand, stopListening, micLevel }
}

// ==================== UI COMPONENT ==================== //
function VoiceController() {
  const { voiceEnabled, toggleVoice, setVoiceEnabled, addNotification } = useOsStore()
  // Voice mode: 'commands' (Mode A - Web Speech API) or 'live' (Mode B - Gemini Live)
  const [voiceMode, setVoiceMode] = useState('commands')
  console.log('[VoiceController] render — voiceMode:', voiceMode, 'voiceEnabled:', voiceEnabled, 'passing active:', voiceMode === 'commands')
  const { isListening, transcript, lastCommand, stopListening, micLevel } = useVoice(voiceMode === 'commands')
  const gemini = useGeminiVoice()
  const [showFeedback, setShowFeedback] = useState(false)

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
                <p className="text-os-text-primary text-sm font-medium">"{lastCommand.text}"</p>
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
            {/* Mic level bar */}
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
            {micLevel < 2 && (
              <span className="text-[10px] text-red-200">⚠ No audio detected — check mic</span>
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
            : 'Voice off'}
      </span>
    </div>
  )
}

export default VoiceController
export { useVoice }
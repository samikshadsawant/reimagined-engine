import axios from 'axios'
import useOsStore from '../store/osStore'
import useWindowStore from '../store/windowStore'
import { getDefaultSize } from '../config/appConfig'
import { getVoiceString, getVoiceSystemReply } from './voiceLocalization'
import { getWelcomeHelpText } from './voiceWelcome'

export function createVoiceActionContext(addNotification = useOsStore.getState().addNotification) {
  const openApp = (name) => {
    useWindowStore.getState().openWindow(name, name, getDefaultSize(name))
  }

  return {
    openApp,
    closeApp: (name) => {
      const { windows, closeWindow } = useWindowStore.getState()
      const target = windows.find((window) => window.app === name && !window.minimized) ||
        windows.find((window) => window.app === name)
      if (target) closeWindow(target.id)
    },
    switchWindow: (name) => {
      const target = useWindowStore.getState().windows.find((window) => window.app === name)
      if (target) useWindowStore.getState().focusWindow(target.id)
    },
    openUrl: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
    searchWeb: (query) => window.open(
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      '_blank',
      'noopener,noreferrer'
    ),
    playOnYouTube: (query) => window.open(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      '_blank',
      'noopener,noreferrer'
    ),
    closeActive: () => {
      const { windows, closeWindow } = useWindowStore.getState()
      const focused = windows.find((window) => window.focused)
      if (focused) closeWindow(focused.id)
    },
    closeAll: () => {
      const { windows, closeWindow } = useWindowStore.getState()
      windows.forEach((window) => closeWindow(window.id))
    },
    minimizeActive: () => {
      const { windows, minimizeWindow } = useWindowStore.getState()
      const focused = windows.find((window) => window.focused)
      if (focused) minimizeWindow(focused.id)
    },
    maximizeActive: () => {
      const { windows, maximizeWindow } = useWindowStore.getState()
      const focused = windows.find((window) => window.focused)
      if (focused) maximizeWindow(focused.id)
    },
    showDesktop: () => {
      const { windows, minimizeWindow } = useWindowStore.getState()
      windows.forEach((window) => minimizeWindow(window.id))
    },
    focusNext: () => useWindowStore.getState().focusNextWindow(),
    focusPrev: () => useWindowStore.getState().focusPrevWindow(),
    zoomIn: () => {
      const current = parseFloat(document.documentElement.style.fontSize || '100')
      document.documentElement.style.fontSize = `${Math.min(current + 25, 200)}%`
    },
    zoomOut: () => {
      const current = parseFloat(document.documentElement.style.fontSize || '100')
      document.documentElement.style.fontSize = `${Math.max(current - 25, 75)}%`
    },
    zoomReset: () => { document.documentElement.style.fontSize = '100%' },
    toggleMute: (muted) => {
      document.querySelectorAll('audio, video').forEach((element) => { element.muted = muted })
    },
    adjustVolume: (delta) => {
      document.querySelectorAll('audio, video').forEach((element) => {
        element.volume = Math.max(0, Math.min(1, element.volume + delta))
      })
    },
    setVolume: (level) => {
      document.querySelectorAll('audio, video').forEach((element) => {
        element.volume = Math.max(0, Math.min(1, level))
      })
    },
    toggleFeature: (feature, enabled) => {
      const state = useOsStore.getState()
      const setters = {
        voice: state.setVoiceEnabled,
        gesture: state.setGestureEnabled,
        eyeTracking: state.setEyeTrackingEnabled,
        signLanguage: state.setSignLanguageEnabled,
        pathGuidance: state.setPathGuidanceEnabled,
        textToSpeech: state.setTTSEnabled,
        gestureCursor: state.setGestureCursorEnabled
      }
      if (feature === 'visualAlerts') {
        if (state.visualAlertsEnabled !== enabled) state.toggleVisualAlerts()
        return
      }
      if (feature === 'sound') {
        if (state.soundEnabled !== enabled) state.toggleSound()
        return
      }
      setters[feature]?.(enabled)
    },
    setContrast: (value) => useOsStore.getState().setContrast(value),
    setCursorSize: (value) => useOsStore.getState().setCursorSize(value),
    applyProfile: (profile) => useOsStore.getState().applyProfile(profile),
    speakHelp: () => getWelcomeHelpText(useOsStore.getState().voiceLanguage || 'english'),
    translateText: (text, targetLang, sourceLang) => {
      useWindowStore.getState().openWindow('Translator', 'Translator', getDefaultSize('Translator'))
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('spiritos:translate', {
          detail: { text, targetLang, sourceLang }
        }))
      }, 150)
    },
    setTheme: (theme) => useOsStore.getState().setTheme(theme),
    setWallpaper: (wallpaper) => useOsStore.getState().setWallpaper(wallpaper),
    setFontSize: (size) => useOsStore.getState().setFontSize(size),
    setFontWeight: (weight) => useOsStore.getState().setFontWeight(weight),
    getFontSize: () => useOsStore.getState().fontSize,
    getFontWeight: () => useOsStore.getState().fontWeight,
    setVoiceLanguage: (language) => useOsStore.getState().setVoiceLanguage(language),
    setSupportPhase: (phase) => useOsStore.getState().setAlzheimerPhase(phase),
    openHelpTour: async () => {
      const response = await fetch('/api/presentations')
      if (!response.ok) throw new Error(`Could not load presentations (${response.status}).`)
      const list = await response.json()
      const welcome = (list || []).find((item) => item.isBuiltin && /welcome/i.test(item.title))
      useWindowStore.getState().openWindow(
        'Presentation',
        'Welcome tour',
        getDefaultSize('Presentation'),
        welcome ? { initialDeckId: welcome.id } : {}
      )
    },
    triggerSOS: async () => {
      const response = await fetch('/api/emergency')
      if (!response.ok) throw new Error(`Could not check emergency contacts (${response.status}).`)
      const contacts = await response.json()
      if (!contacts?.length) {
        useWindowStore.getState().openWindow('Emergency', 'SOS Contacts', getDefaultSize('Emergency'))
        return
      }
      window.dispatchEvent(new CustomEvent('spiritos:sos'))
    },
    fileSearch: (query, path = '/') => {
      openApp('FileExplorer')
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('spiritos:file-search', {
          detail: { query, path }
        }))
      }, 250)
    },
    fileCreate: async ({ name, type, path = '/' }) => {
      await axios.post('/api/fs/create', { name, type, path })
      openApp('FileExplorer')
    },
    fileOpen: async (path) => {
      openApp('FileExplorer')
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('spiritos:file-open', { detail: { path } }))
      }, 250)
    },
    fileNavigate: async (path) => {
      if (typeof path !== 'string' || !path.startsWith('/') || /\\|:|(?:^|\/)\.\.(?:\/|$)/u.test(path)) {
        throw new Error('Folder path must remain inside the filesystem root.')
      }
      openApp('FileExplorer')
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('spiritos:file-navigate', { detail: { path } }))
      }, 250)
    },
    fileRename: async (params) => {
      await axios.post('/api/fs/rename', params)
      openApp('FileExplorer')
    },
    fileMove: async (params) => {
      await axios.post('/api/fs/move', params)
      openApp('FileExplorer')
    },
    fileCopy: async (params) => {
      await axios.post('/api/fs/copy', params)
      openApp('FileExplorer')
    },
    fileDelete: async (path) => {
      await axios.delete('/api/fs/delete', { data: { path } })
      openApp('FileExplorer')
    },
    presentationDispatch: (command) => {
      window.dispatchEvent(new CustomEvent('spiritos:presentation', { detail: { cmd: command } }))
    },
    refresh: () => window.location.reload(),
    getTimeReply: () => {
      const state = useOsStore.getState()
      const language = state.voiceLanguage || 'english'
      const locale = ({ hindi: 'hi-IN', marathi: 'mr-IN', tamil: 'ta-IN' })[language] || 'en-US'
      const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date())
      return getVoiceSystemReply('time', language, time)
    },
    getDateReply: () => {
      const state = useOsStore.getState()
      const language = state.voiceLanguage || 'english'
      const locale = ({ hindi: 'hi-IN', marathi: 'mr-IN', tamil: 'ta-IN' })[language] || 'en-US'
      const date = new Intl.DateTimeFormat(locale, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }).format(new Date())
      return getVoiceSystemReply('date', language, date)
    },
    getBatteryReply: async () => {
      const language = useOsStore.getState().voiceLanguage || 'english'
      if (!('getBattery' in navigator)) return getVoiceString('batteryUnavailable', language)
      const battery = await navigator.getBattery()
      const locale = ({ hindi: 'hi-IN', marathi: 'mr-IN', tamil: 'ta-IN' })[language] || 'en-US'
      const percent = new Intl.NumberFormat(locale).format(Math.round(battery.level * 100))
      return getVoiceSystemReply('battery', language, percent, battery.charging)
    },
    addNotification
  }
}

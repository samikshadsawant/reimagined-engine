/**
 * voiceIntents.js
 *
 * High-level intent parser for the SpiritOS voice assistant.
 * The simple keyword matcher in VoiceController handles single-word commands;
 * this file handles structured intents that need argument extraction:
 *
 *   • Reminders / alarms       — "remind me to take pill at 9 am"
 *   • Cancel / list reminders  — "delete reminder for water"
 *   • SOS                       — "call for help"
 *   • Theme / accessibility     — "switch to dark mode"
 *   • Window control            — "close calculator"
 *   • Open arbitrary app        — "open notes"
 *
 * Each parser returns null if the utterance doesn't match, or an object
 * { intent, args } if it does. The VoiceController then dispatches that
 * intent through `executeIntent`.
 */

import axios from 'axios'

// ── Time parsing ──────────────────────────────────────────────────────────────
// Accepts "9", "9 am", "9:30", "9:30 pm", "noon", "midnight", "in 5 minutes"
// Returns { hh: 0-23, mm: 0-59 } or null.
export function parseTimePhrase(input) {
  const s = (input || '').trim().toLowerCase()
  if (!s) return null

  if (/^(noon|mid\s?day)$/.test(s))     return { hh: 12, mm: 0 }
  if (/^midnight$/.test(s))             return { hh: 0,  mm: 0 }

  // "in N minutes/hours"
  const rel = s.match(/^in\s+(\d{1,3})\s*(min(?:ute)?s?|hr?s?|hours?)$/)
  if (rel) {
    const n = parseInt(rel[1], 10)
    const unit = rel[2]
    const now = new Date()
    if (/^h/.test(unit)) now.setHours(now.getHours() + n)
    else                  now.setMinutes(now.getMinutes() + n)
    return { hh: now.getHours(), mm: now.getMinutes() }
  }

  // "9", "09", "9:30", "9:30 pm", "9 am"
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/)
  if (!m) return null
  let hh = parseInt(m[1], 10)
  const mm = m[2] ? parseInt(m[2], 10) : 0
  const meridian = (m[3] || '').replace(/\./g, '')
  if (mm > 59) return null
  if (hh > 23) return null

  if (meridian === 'pm' && hh < 12) hh += 12
  if (meridian === 'am' && hh === 12) hh = 0
  // No meridian and hh < 8 — likely meant PM (people usually mean evening times)
  // Comment this out if too aggressive; for an elderly assistant we err on
  // confirming via TTS rather than guessing here.
  return { hh, mm }
}

// Format helpers
export const pad2 = (n) => n.toString().padStart(2, '0')
export const fmtTime = ({ hh, mm }) => `${pad2(hh)}:${pad2(mm)}`
export const fmtTime12 = ({ hh, mm }) => {
  const m = mm.toString().padStart(2, '0')
  if (hh === 0) return `12:${m} AM`
  if (hh === 12) return `12:${m} PM`
  if (hh < 12) return `${hh}:${m} AM`
  return `${hh - 12}:${m} PM`
}

// ── App resolution ────────────────────────────────────────────────────────────
const APPS = [
  { key: 'file explorer',   app: 'FileExplorer' },
  { key: 'files',           app: 'FileExplorer' },
  { key: 'explorer',        app: 'FileExplorer' },
  { key: 'calculator',      app: 'Calculator' },
  { key: 'calc',            app: 'Calculator' },
  { key: 'terminal',        app: 'Terminal' },
  { key: 'notes',           app: 'Notes' },
  { key: 'notepad',         app: 'Notes' },
  { key: 'browser',         app: 'Browser' },
  { key: 'web',             app: 'Browser' },
  { key: 'settings',        app: 'Settings' },
  { key: 'preferences',     app: 'Settings' },
  { key: 'translator',      app: 'Translator' },
  { key: 'translate',       app: 'Translator' },
  { key: 'presentation',    app: 'Presentation' },
  { key: 'slides',          app: 'Presentation' },
  { key: 'reminders',       app: 'Reminders' },
  { key: 'reminder',        app: 'Reminders' },
  { key: 'alarms',          app: 'Reminders' },
  { key: 'sos',             app: 'Emergency' },
  { key: 'emergency',       app: 'Emergency' },
  { key: 'contacts',        app: 'Emergency' },
  { key: 'mail',            app: 'Mail' },
  { key: 'email',           app: 'Mail' },
  { key: 'known book',      app: 'KnownBook' },
  { key: 'people',          app: 'KnownBook' },
  { key: 'vault',           app: 'Vault' },
  { key: 'secure vault',    app: 'Vault' },
  { key: 'passwords',       app: 'Vault' }
]
export function resolveApp(text) {
  const normalized = text.toLowerCase()
  // Longest key first so "file explorer" wins over "files"
  const sorted = [...APPS].sort((a, b) => b.key.length - a.key.length)
  const m = sorted.find((it) => normalized.includes(it.key))
  return m ? m.app : null
}

// ── Intent parsers ────────────────────────────────────────────────────────────
// Each returns { intent, args } or null.

function parseReminderCreate(text) {
  // Patterns we accept:
  //   "remind me to <body> at <time>"
  //   "set a reminder for <body> at <time>"
  //   "set alarm at <time> for <body>"
  //   "set alarm at <time>"
  //   "set alarm for <time>"
  let m = text.match(/^(?:remind me to|remind me|set a reminder (?:to|for)?)\s+(.+?)\s+at\s+(.+)$/i)
  if (m) return { intent: 'reminder.create', args: { title: m[1].trim(), time: m[2].trim() } }

  m = text.match(/^set\s+(?:an?\s+)?alarm\s+(?:for|at)\s+([\d:apmnoo\s.]+?)(?:\s+(?:to|for)\s+(.+))?$/i)
  if (m) {
    return {
      intent: 'reminder.create',
      args: { title: (m[2] || 'Alarm').trim(), time: m[1].trim() }
    }
  }

  m = text.match(/^remind me at\s+(.+?)\s+(?:to|for)\s+(.+)$/i)
  if (m) return { intent: 'reminder.create', args: { title: m[2].trim(), time: m[1].trim() } }

  return null
}

function parseReminderDelete(text) {
  const m = text.match(/^(?:delete|remove|cancel)\s+(?:the\s+)?(?:reminder|alarm)(?:\s+(?:to|for|about)\s+(.+))?$/i)
  if (!m) return null
  return { intent: 'reminder.delete', args: { match: (m[1] || '').trim() } }
}

function parseReminderList(text) {
  if (/^(?:list|show|what are|tell me)\s+(?:my\s+)?(?:reminders|alarms)$/i.test(text)) {
    return { intent: 'reminder.list', args: {} }
  }
  return null
}

function parseSOS(text) {
  if (/^(?:sos|emergency|call for help|help me now|i need help|call (?:my )?son|call (?:my )?daughter|call (?:my )?doctor)$/i.test(text)) {
    return { intent: 'sos.trigger', args: {} }
  }
  return null
}

function parseTheme(text) {
  const m = text.match(/^(?:switch (?:to )?|use |turn on |enable |go )?(dark|light)\s*(?:mode|theme)?$/i)
  if (m) return { intent: 'theme.set', args: { theme: m[1].toLowerCase() } }
  return null
}

function parseFontSize(text) {
  const m = text.match(/^(?:make (?:font|text) )?(bigger|larger|smaller|normal)\s*(?:font|text)?$/i)
  if (!m) return null
  const map = { bigger: 'large', larger: 'large', smaller: 'normal', normal: 'normal' }
  return { intent: 'font.set', args: { size: map[m[1].toLowerCase()] || 'normal' } }
}

function parseProfile(text) {
  // "switch to elderly profile", "elderly mode", etc
  const known = ['default', 'elderly', 'visually-impaired', 'visually impaired',
                 'motor-impaired', 'motor impaired', 'beginner']
  for (const p of known) {
    const re = new RegExp(`(?:switch to |use |apply )?(${p})\\s*(?:profile|mode)$`, 'i')
    const m = text.match(re)
    if (m) return { intent: 'profile.apply', args: { profile: p.replace(/\s/g, '-') } }
  }
  return null
}

function parseWindow(text) {
  // open / close / minimize / maximize / focus
  let m = text.match(/^(?:open|launch|start)\s+(.+)$/i)
  if (m) {
    const app = resolveApp(m[1])
    if (app) return { intent: 'window.open', args: { app } }
  }
  m = text.match(/^close\s+(.+)$/i)
  if (m) {
    if (/^(?:window|this|it|app)$/i.test(m[1].trim())) {
      return { intent: 'window.closeActive', args: {} }
    }
    const app = resolveApp(m[1])
    if (app) return { intent: 'window.close', args: { app } }
  }
  if (/^(?:close|exit|quit)\s+(?:window|this|it|app)$/i.test(text)) {
    return { intent: 'window.closeActive', args: {} }
  }
  if (/^close\s+everything|close all/i.test(text)) {
    return { intent: 'window.closeAll', args: {} }
  }
  if (/^minimi[zs]e/i.test(text)) return { intent: 'window.minimize', args: {} }
  if (/^maximi[zs]e|fullscreen|full screen/i.test(text)) return { intent: 'window.maximize', args: {} }
  if (/^(?:show desktop|go home|go to desktop)$/i.test(text)) return { intent: 'window.desktop', args: {} }
  if (/^(?:next window|switch (?:window|to next))$/i.test(text)) return { intent: 'window.next', args: {} }
  if (/^(?:previous window|last window|switch (?:back|to previous))$/i.test(text)) return { intent: 'window.prev', args: {} }
  return null
}

function parseSystem(text) {
  if (/^(?:what (?:is the |s the )?time|time|current time)$/i.test(text)) return { intent: 'system.time', args: {} }
  if (/^(?:what (?:is the |s the )?date|date|today.?s? date|what day)/i.test(text)) return { intent: 'system.date', args: {} }
  if (/^battery|battery (?:status|level)$/i.test(text)) return { intent: 'system.battery', args: {} }
  if (/^refresh|reload$/i.test(text)) return { intent: 'system.refresh', args: {} }
  if (/^scroll down/i.test(text)) return { intent: 'system.scrollDown', args: {} }
  if (/^scroll up/i.test(text)) return { intent: 'system.scrollUp', args: {} }
  return null
}

function parsePresentation(text) {
  if (/^(?:next slide|next|forward)$/i.test(text)) return { intent: 'presentation.next', args: {} }
  if (/^(?:previous slide|previous|back|go back)$/i.test(text)) return { intent: 'presentation.prev', args: {} }
  if (/^(?:read (?:this|it|aloud|slide))$/i.test(text)) return { intent: 'presentation.read', args: {} }
  if (/^(?:stop|exit|close) (?:presentation|slides)$/i.test(text)) return { intent: 'presentation.close', args: {} }
  return null
}

function parseSearch(text) {
  const m = text.match(/^(?:search|google|look up|find)\s+(?:for\s+)?(.+)$/i)
  if (m) return { intent: 'web.search', args: { query: m[1].trim() } }
  const yt = text.match(/^play\s+(.+?)\s+(?:on\s+)?(?:youtube|yt)$/i)
  if (yt) return { intent: 'web.youtube', args: { query: yt[1].trim() } }
  return null
}

function parseHelp(text) {
  if (/^(?:help|help me|show help|open help|welcome tour|tour|how do i use this|guide me)$/i.test(text)) {
    return { intent: 'help.tour', args: {} }
  }
  if (/^(?:what can you do|commands|voice commands|list commands)$/i.test(text)) {
    return { intent: 'help.list', args: {} }
  }
  return null
}

// ── Main intent parser — try parsers in priority order ────────────────────────
const PARSERS = [
  parseSOS,                // urgent — first
  parseReminderCreate,
  parseReminderDelete,
  parseReminderList,
  parsePresentation,
  parseTheme,
  parseFontSize,
  parseProfile,
  parseWindow,
  parseSystem,
  parseSearch,
  parseHelp
]

export function parseIntent(rawText) {
  const text = (rawText || '').trim().toLowerCase().replace(/[.?!]+$/, '')
  if (!text) return null
  for (const p of PARSERS) {
    const r = p(text)
    if (r) return r
  }
  return null
}

// ── Intent executor ───────────────────────────────────────────────────────────
// All side-effects live here. Returns a Promise that resolves to a feedback
// string the caller can speak / show.

export async function executeIntent({ intent, args }, deps) {
  const {
    openApp, closeActive, closeAll, minimizeActive, maximizeActive,
    showDesktop, focusNext, focusPrev,
    speakOut, addNotification,
    setTheme, setFontSize, applyProfile,
    closeAppByName,
    presentationDispatch,
    googleSearch, openYouTube,
    openHelpTour, listVoiceCommands,
    triggerSOS
  } = deps

  switch (intent) {
    case 'reminder.create': {
      const t = parseTimePhrase(args.time)
      if (!t) return `I didn't catch the time. Try saying for example "at 9 am".`
      try {
        await axios.post('/api/reminders', {
          title: args.title || 'Reminder',
          timeOfDay: fmtTime(t),
          daysMask: '1111111',
          enabled: true,
          speakAloud: true
        })
        return `Okay. I'll remind you to ${args.title} at ${fmtTime12(t)} every day.`
      } catch (err) {
        return `Sorry, I couldn't save the reminder. ${err?.response?.data?.error || err.message}`
      }
    }

    case 'reminder.delete': {
      try {
        const all = (await axios.get('/api/reminders')).data || []
        const needle = (args.match || '').toLowerCase()
        const target = needle
          ? all.find((r) => r.title.toLowerCase().includes(needle))
          : all[0]
        if (!target) return needle
          ? `I couldn't find a reminder matching "${args.match}".`
          : `You have no reminders to delete.`
        await axios.delete(`/api/reminders/${target.id}`)
        return `Deleted the reminder "${target.title}".`
      } catch (err) {
        return `Sorry, I couldn't delete that. ${err?.response?.data?.error || err.message}`
      }
    }

    case 'reminder.list': {
      try {
        const all = (await axios.get('/api/reminders')).data || []
        if (!all.length) return 'You have no reminders.'
        const lines = all.slice(0, 6).map((r) => {
          const [hh, mm] = r.timeOfDay.split(':').map(Number)
          return `${r.title} at ${fmtTime12({ hh, mm })}`
        })
        return `You have ${all.length} reminder${all.length === 1 ? '' : 's'}: ${lines.join('; ')}.`
      } catch (err) {
        return `Could not read reminders. ${err.message}`
      }
    }

    case 'sos.trigger':
      triggerSOS()
      return 'Starting SOS countdown.'

    case 'theme.set':
      setTheme(args.theme)
      return `Switched to ${args.theme} mode.`

    case 'font.set':
      setFontSize(args.size)
      return `Font size set to ${args.size}.`

    case 'profile.apply':
      applyProfile(args.profile)
      return `Switched to ${args.profile.replace('-', ' ')} profile.`

    case 'window.open':
      openApp(args.app)
      return `Opening ${args.app}.`

    case 'window.close':
      closeAppByName(args.app)
      return `Closed ${args.app}.`

    case 'window.closeActive':
      closeActive()
      return 'Window closed.'

    case 'window.closeAll':
      closeAll()
      return 'All windows closed.'

    case 'window.minimize':
      minimizeActive()
      return 'Window minimised.'

    case 'window.maximize':
      maximizeActive()
      return 'Window maximised.'

    case 'window.desktop':
      showDesktop()
      return 'Showing the desktop.'

    case 'window.next':
      focusNext()
      return 'Switched to the next window.'

    case 'window.prev':
      focusPrev()
      return 'Switched to the previous window.'

    case 'system.time': {
      const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      return `It is ${t}.`
    }
    case 'system.date': {
      const d = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      return `Today is ${d}.`
    }
    case 'system.battery': {
      if (!('getBattery' in navigator)) return 'Battery information is not available.'
      const b = await navigator.getBattery()
      return `Battery is at ${Math.round(b.level * 100)} percent${b.charging ? ', and charging' : ''}.`
    }
    case 'system.refresh':
      window.location.reload()
      return 'Refreshing.'
    case 'system.scrollDown':
      window.scrollBy(0, 300)
      return ''
    case 'system.scrollUp':
      window.scrollBy(0, -300)
      return ''

    case 'presentation.next':   presentationDispatch('next');   return 'Next slide.'
    case 'presentation.prev':   presentationDispatch('prev');   return 'Previous slide.'
    case 'presentation.read':   presentationDispatch('read');   return 'Reading aloud.'
    case 'presentation.close':  presentationDispatch('close');  return 'Closing presentation.'

    case 'web.search':  googleSearch(args.query);  return `Searching for ${args.query}.`
    case 'web.youtube': openYouTube(args.query);   return `Looking that up on YouTube.`

    case 'help.tour':   await openHelpTour();      return 'Opening the welcome tour.'
    case 'help.list':   listVoiceCommands();       return null

    default:
      return null
  }
}

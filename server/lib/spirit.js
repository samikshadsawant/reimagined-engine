/**
 * server/lib/spirit.js — Spirit, the offline assistant
 *
 * Architecture:
 *   1. The user's utterance is normalised + filler words stripped.
 *   2. We score it against every known intent (each intent has a set of
 *      weighted keywords and may also extract slots like time / app name).
 *   3. The highest-scoring intent that ALSO has every required slot filled
 *      wins. Missing slots trigger a one-turn clarification — the question
 *      is stored in `pendingIntent` so the next utterance fills the gap.
 *   4. Conversation memory is persisted in the AgentSession DB row.
 *
 * No LLM. No external HTTP calls. Pure JavaScript + 3 small NPM libs
 * (compromise, fuse.js, chrono-node).
 */

const nlp = require('./nlp')

// ── memory ───────────────────────────────────────────────────────────────────
const MEM_LIMIT = 30  // history entries per user

async function loadSession(prisma, sessionId) {
  if (!prisma || !sessionId) return { history: [], pending: null }
  try {
    const row = await prisma.agentSession.findUnique({ where: { sessionId } })
    if (!row) return { history: [], pending: null }
    const blob = JSON.parse(row.history || '{}')
    // Backwards compat: old code stored a bare array
    if (Array.isArray(blob)) return { history: blob, pending: null }
    return {
      history: Array.isArray(blob.history) ? blob.history : [],
      pending: blob.pending || null
    }
  } catch (_) {
    return { history: [], pending: null }
  }
}

async function saveSession(prisma, sessionId, session) {
  if (!prisma || !sessionId) return
  const slim = {
    history: session.history.slice(-MEM_LIMIT),
    pending: session.pending || null
  }
  const json = JSON.stringify(slim)
  try {
    await prisma.agentSession.upsert({
      where:  { sessionId },
      create: { sessionId, history: json },
      update: { history: json }
    })
  } catch (_) {}
}

// ── tiny helpers ─────────────────────────────────────────────────────────────
const cap1 = (s) => s ? s[0].toUpperCase() + s.slice(1) : s
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

// ── action factories — what the frontend executes ───────────────────────────
const A = {
  openApp:        (app)            => ({ action: 'openApp',         target: app }),
  closeApp:       (app)            => ({ action: 'closeApp',        target: app }),
  closeActive:    ()               => ({ action: 'closeApp' }),
  closeAll:       ()               => ({ action: 'closeAll' }),
  minimize:       ()               => ({ action: 'minimizeWindow' }),
  maximize:       ()               => ({ action: 'maximizeWindow' }),
  showDesktop:    ()               => ({ action: 'showDesktop' }),
  nextWindow:     ()               => ({ action: 'nextWindow' }),
  prevWindow:     ()               => ({ action: 'previousWindow' }),
  theme:          (v)              => ({ action: 'changeSetting', target: 'theme',    value: v }),
  fontSize:       (v)              => ({ action: 'changeSetting', target: 'fontSize', value: v }),
  toggle:         (k, v)           => ({ action: 'changeSetting', target: k,          value: v }),
  profile:        (p)              => ({ action: 'applyProfile',  target: p }),
  reminder:       (title, hhmm)    => ({ action: 'createReminder', title, timeOfDay: hhmm }),
  rmReminder:     (match)          => ({ action: 'deleteReminder', match }),
  sos:            ()               => ({ action: 'triggerSOS' }),
  openSite:       (url)            => ({ action: 'openWebsite', url }),
  search:         (q)              => ({ action: 'search', query: q }),
  helpTour:       ()               => ({ action: 'openHelpTour' }),
  presentation:   (cmd)            => ({ action: 'presentation', target: cmd }),
  composeNote:    (text)           => ({ action: 'composeNote', text }),
  translate:      (text, lang)     => ({ action: 'translate', text, target: lang })
}

// ── intent definitions ──────────────────────────────────────────────────────
// Each intent is a function that takes the cleaned text and returns:
//   null            — doesn't match
//   { score, fn }   — match score (used to pick the winner) + handler
//
// The handler is async: handler(ctx) -> { message, action?, slot? }.
// If a slot is missing, the handler returns { message, slot: { name, intent, ... } }
// and we save it as `pendingIntent` until the next utterance fills it in.

const INTENTS = []
function def(name, scorer) { INTENTS.push({ name, scorer }) }

// ── SOS — highest priority, low confidence threshold ───────────────────────
def('sos', (text) => {
  const v = nlp.scoreTopics(text, {
    sos: [['sos', 5], ['emergency', 5], ['help me', 4], ['call for help', 4],
          ['i need help', 3], ['call doctor', 3], ['call my son', 2],
          ['call my daughter', 2], ['danger', 4]]
  })
  if (!v) return null
  return {
    score: v.score + 100, // beats everything else
    fn: async () => ({ message: 'Starting SOS countdown.', action: A.sos() })
  }
})

// ── reminders ────────────────────────────────────────────────────────────────
def('reminder.create', (text) => {
  // Catch typical reminder phrasings
  const isReminder = /\b(remind|reminder|alarm|wake me|wake up|notify me)\b/.test(text)
                  || /^(set|add|create|make).*(alarm|reminder)/.test(text)
  if (!isReminder) return null

  // Strip out the time phrase first so the remaining words are pure title.
  // We use chrono to find where the time sits and remove that span.
  let title = null
  const time = nlp.extractTime(text)
  let stripped = text

  if (time?.raw) {
    // Remove the time chunk and any leading 'at/on/by/@' so the rest of the
    // phrase is a clean title.
    const re = new RegExp(`\\s*(?:at|on|by|@)?\\s*${nlp.escapeRe(time.raw)}\\b`, 'i')
    stripped = text.replace(re, '')
  }

  // Now pull title out of the cleaned phrase.
  let m = stripped.match(/(?:remind me to|reminder to|alarm to|wake me up to)\s+(.+?)\s*$/i)
            || stripped.match(/(?:reminder|alarm)\s+for\s+(.+?)\s*$/i)
            || stripped.match(/(?:remind me|notify me)\s+to\s+(.+?)\s*$/i)
            || stripped.match(/^(?:set|add|create|make)\s+(?:an?\s+)?(?:alarm|reminder)\s+to\s+(.+?)\s*$/i)
  if (m) title = m[1].trim().replace(/^(?:to|for)\s+/, '').replace(/\s+(?:every day|daily)$/i, '')

  return {
    score: 50 + (time ? 8 : 0) + (title ? 4 : 0),
    fn: async (ctx) => {
      // Slot filling: missing time
      if (!time) {
        return {
          message: title
            ? `What time should I remind you to ${title}?`
            : 'What time should I set the reminder for?',
          slot: { name: 'time', intent: 'reminder.create', title }
        }
      }
      if (!title) {
        return {
          message: `Sure. What should I remind you about at ${nlp.fmt12(time)}?`,
          slot: { name: 'title', intent: 'reminder.create', time }
        }
      }
      return saveReminder(title, time, ctx)
    }
  }
})

async function saveReminder(title, time, { prisma, sessionId }) {
  let ok = true
  try {
    await prisma.reminder.create({
      data: {
        userName:   sessionId,
        title:      title || 'Reminder',
        timeOfDay:  nlp.fmt24(time),
        daysMask:   '1111111',
        enabled:    true,
        speakAloud: true
      }
    })
  } catch (err) {
    ok = false
    console.warn('[Spirit] reminder save failed:', err.message)
  }
  return {
    message: ok
      ? `Okay, I'll remind you to ${title} at ${nlp.fmt12(time)} every day.`
      : `I couldn't save that reminder right now. Open the Reminders app and try again.`,
    action: ok ? A.reminder(title, nlp.fmt24(time)) : null
  }
}

def('reminder.delete', (text) => {
  const isDelete = /\b(delete|remove|cancel|clear|stop)\b.*\b(reminder|reminders|alarm|alarms)\b/.test(text)
                || /\b(reminder|alarm)s?\s+(off|away|done)\b/.test(text)
  if (!isDelete) return null
  const all = /\ball\b|\bevery\b|\beverything\b/.test(text)
  const m = text.match(/(?:to|for|about)\s+(.+)$/)
  const matchStr = m ? m[1].trim() : ''
  return {
    score: 45,
    fn: async ({ prisma, sessionId }) => {
      const list = await prisma.reminder.findMany({ where: { userName: sessionId } })
      if (!list.length) return { message: 'You have no reminders to delete.' }
      if (all) {
        await prisma.reminder.deleteMany({ where: { userName: sessionId } })
        return { message: `Deleted all ${list.length} reminders.` }
      }
      const target = matchStr
        ? list.find(r => r.title.toLowerCase().includes(matchStr.toLowerCase()))
        : list[0]
      if (!target) return { message: `I couldn't find a reminder matching "${matchStr}".` }
      await prisma.reminder.delete({ where: { id: target.id } })
      return { message: `Deleted the reminder "${target.title}".`, action: A.rmReminder(matchStr || target.title) }
    }
  }
})

def('reminder.list', (text) => {
  const v = nlp.scoreTopics(text, {
    list: [['list reminders', 4], ['show reminders', 4], ['my reminders', 3],
           ['all reminders', 3], ['what reminders', 3], ['list alarms', 3],
           ['show alarms', 3], ['next reminder', 3], ['upcoming reminder', 2]]
  })
  if (!v) return null
  return {
    score: 40,
    fn: async ({ prisma, sessionId }) => {
      const list = await prisma.reminder.findMany({
        where:   { userName: sessionId },
        orderBy: { timeOfDay: 'asc' }
      })
      if (!list.length) return { message: 'You have no reminders.' }
      const lines = list.slice(0, 6).map(r => {
        const [hh, mm] = r.timeOfDay.split(':').map(Number)
        return `${r.title} at ${nlp.fmt12({ hh, mm })}`
      })
      return { message: `You have ${list.length} reminder${list.length === 1 ? '' : 's'}: ${lines.join('; ')}.` }
    }
  }
})

// ── theme / font / profile ──────────────────────────────────────────────────
def('theme', (text) => {
  const t = nlp.extractTheme(text)
  if (!t) return null
  const v = nlp.scoreTopics(text, {
    theme: [['mode', 2], ['theme', 2], ['ui', 1],
            ['switch to', 2], ['change to', 2], ['use', 1], ['turn on', 1]]
  })
  if (!v && !/\b(dark|light)\b/.test(text)) return null
  return {
    score: 35 + (v?.score || 0),
    fn: async () => ({ message: `Switched to ${t} mode.`, action: A.theme(t) })
  }
})

def('font.size', (text) => {
  const f = nlp.extractFontSize(text)
  if (!f) return null
  const v = nlp.scoreTopics(text, {
    font: [['font', 3], ['text', 2], ['letter', 2], ['letters', 2],
           ['size', 2], ['zoom', 2], ['enlarge', 2], ['bigger', 2], ['smaller', 2]]
  })
  if (!v) return null
  return {
    score: 30 + v.score,
    fn: async () => ({ message: `Font size set to ${f}.`, action: A.fontSize(f) })
  }
})

def('profile', (text) => {
  const p = nlp.extractProfile(text)
  if (!p) return null
  const v = nlp.scoreTopics(text, {
    profile: [['profile', 3], ['mode', 2], ['preset', 2], ['user setting', 1]]
  })
  if (!v) return null
  return {
    score: 28 + v.score,
    fn: async () => ({ message: `Switched to ${p.replace('-', ' ')} profile.`, action: A.profile(p) })
  }
})

// ── window / app control ────────────────────────────────────────────────────
def('window.open', (text) => {
  // Prefer bare "open <app>" → app intent
  const verb = /\b(open|launch|start|show|bring up|run|fire up)\b/.test(text)
  if (!verb) return null
  const app = nlp.extractApp(text)
  if (!app) return null
  return {
    score: 25 + (verb ? 5 : 0),
    fn: async () => ({ message: `Opening ${app}.`, action: A.openApp(app) })
  }
})

def('web.open', (text) => {
  const verb = /\b(open|go to|visit|launch|show me)\b/.test(text)
  if (!verb) return null
  const site = nlp.extractWebsite(text)
  if (!site) return null
  return {
    score: 22,
    fn: async () => ({ message: `Opening ${site.name}.`, action: A.openSite(site.url) })
  }
})

def('window.close', (text) => {
  if (!/\b(close|quit|exit|kill|shut)\b/.test(text)) return null
  if (/\bclose\s+(?:every|all|everything)\b/.test(text)) {
    return { score: 30, fn: async () => ({ message: 'All windows closed.', action: A.closeAll() }) }
  }
  const app = nlp.extractApp(text)
  if (app) return { score: 24, fn: async () => ({ message: `Closing ${app}.`, action: A.closeApp(app) }) }
  if (/\b(window|this|it|that|active|current|the app)\b/.test(text)) {
    return { score: 22, fn: async () => ({ message: 'Closing the window.', action: A.closeActive() }) }
  }
  return null
})

def('window.minimize',  (text) => /^minimi[zs]e/.test(text)
  ? { score: 20, fn: async () => ({ message: 'Minimised.', action: A.minimize() }) } : null)
def('window.maximize',  (text) => /^maximi[zs]e|^fullscreen|^full screen/.test(text)
  ? { score: 20, fn: async () => ({ message: 'Maximised.', action: A.maximize() }) } : null)
def('window.desktop',   (text) => /^(?:show desktop|go home|go to desktop|hide windows)\b/.test(text)
  ? { score: 20, fn: async () => ({ message: 'Showing the desktop.', action: A.showDesktop() }) } : null)
def('window.next',      (text) => /^(?:next window|switch (?:window|to next)|other window)\b/.test(text)
  ? { score: 20, fn: async () => ({ message: 'Next window.', action: A.nextWindow() }) } : null)
def('window.prev',      (text) => /^(?:previous window|last window|switch (?:back|to previous))\b/.test(text)
  ? { score: 20, fn: async () => ({ message: 'Previous window.', action: A.prevWindow() }) } : null)

// ── system info ─────────────────────────────────────────────────────────────
def('sys.time', (text) => /\b(what(?:'s| is)? )?time\b|^current time$|^the time$/.test(text)
  ? { score: 18, fn: async () => ({ message: `It is ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.` }) }
  : null)
def('sys.date', (text) => /\b(what(?:'s| is)? )?(today|the date|the day|day of the week)|today.?s? date|what day is it/.test(text)
  ? { score: 18, fn: async () => ({ message: `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.` }) }
  : null)

// ── input toggles ───────────────────────────────────────────────────────────
def('toggle.gesture', (text) => {
  const v = nlp.scoreTopics(text, { x: [['gesture', 3], ['hand', 2]] })
  if (!v) return null
  if (/\b(turn on|enable|start|activate)\b/.test(text))   return { score: 22, fn: async () => ({ message: 'Hand gestures on.',  action: A.toggle('gestureEnabled', true) }) }
  if (/\b(turn off|disable|stop|deactivate)\b/.test(text)) return { score: 22, fn: async () => ({ message: 'Hand gestures off.', action: A.toggle('gestureEnabled', false) }) }
  return null
})

def('toggle.eye', (text) => {
  const v = nlp.scoreTopics(text, { x: [['eye tracking', 4], ['eye track', 3], ['gaze', 2]] })
  if (!v) return null
  if (/\b(turn on|enable|start|activate)\b/.test(text))   return { score: 22, fn: async () => ({ message: 'Eye tracking on.',  action: A.toggle('eyeTrackingEnabled', true) }) }
  if (/\b(turn off|disable|stop|deactivate)\b/.test(text)) return { score: 22, fn: async () => ({ message: 'Eye tracking off.', action: A.toggle('eyeTrackingEnabled', false) }) }
  return null
})

def('toggle.voice', (text) => {
  if (!/\b(voice|speech|microphone|mic)\b/.test(text)) return null
  if (/\b(stop listening|shut up|be quiet|turn off voice|disable voice)\b/.test(text)) {
    return { score: 25, fn: async () => ({ message: 'Voice off.', action: A.toggle('voiceEnabled', false) }) }
  }
  return null
})

def('toggle.tts', (text) => {
  const v = nlp.scoreTopics(text, { x: [['read aloud', 4], ['text to speech', 4], ['tts', 3], ['speak my', 2]] })
  if (!v) return null
  if (/\b(turn on|enable|start|activate)\b/.test(text))   return { score: 22, fn: async () => ({ message: 'Read-aloud on.',  action: A.toggle('ttsEnabled', true) }) }
  if (/\b(turn off|disable|stop|deactivate)\b/.test(text)) return { score: 22, fn: async () => ({ message: 'Read-aloud off.', action: A.toggle('ttsEnabled', false) }) }
  return null
})

// ── presentation ────────────────────────────────────────────────────────────
def('pres.next',  (text) => /^(?:next slide|next|forward)$|advance the slide/.test(text)
  ? { score: 18, fn: async () => ({ message: 'Next slide.', action: A.presentation('next') }) } : null)
def('pres.prev',  (text) => /^(?:previous slide|previous|back|go back)$|back a slide/.test(text)
  ? { score: 18, fn: async () => ({ message: 'Previous slide.', action: A.presentation('prev') }) } : null)
def('pres.read',  (text) => /\bread (?:this|it|aloud|slide|out loud)\b/.test(text)
  ? { score: 22, fn: async () => ({ message: 'Reading the slide.', action: A.presentation('read') }) } : null)
def('pres.close', (text) => /\b(?:stop|exit|close) (?:presentation|slides|deck|slideshow)\b/.test(text)
  ? { score: 22, fn: async () => ({ message: 'Closing the presentation.', action: A.presentation('close') }) } : null)

// ── search / web ────────────────────────────────────────────────────────────
def('web.search', (text) => {
  const q = nlp.extractSearchQuery(text)
  if (!q) return null
  // YouTube preference
  const yt = q.match(/^(.+?)\s+(?:on\s+)?(?:youtube|yt)$/i)
  if (yt) {
    return {
      score: 22,
      fn: async () => ({
        message: `Looking that up on YouTube.`,
        action: A.openSite(`https://www.youtube.com/results?search_query=${encodeURIComponent(yt[1])}`)
      })
    }
  }
  return {
    score: 20,
    fn: async () => ({ message: `Searching the web for ${q}.`, action: A.search(q) })
  }
})

def('web.youtube', (text) => {
  const m = text.match(/^play\s+(.+?)\s+(?:on\s+)?(?:youtube|yt)$/)
  if (!m) return null
  return {
    score: 22,
    fn: async () => ({
      message: `Looking up "${m[1]}" on YouTube.`,
      action: A.openSite(`https://www.youtube.com/results?search_query=${encodeURIComponent(m[1])}`)
    })
  }
})

// ── notes ───────────────────────────────────────────────────────────────────
def('notes.compose', (text) => {
  const m = text.match(/^(?:write|note|jot down|remember|save|add a note)\s+(.+)$/)
  if (!m) return null
  const note = m[1].trim()
  return {
    score: 25,
    fn: async () => ({
      message: `Got it. I added a note: "${note}".`,
      action: A.composeNote(note)
    })
  }
})

// ── translate ───────────────────────────────────────────────────────────────
def('translate', (text) => {
  // "translate <text> to <lang>"  /  "in <lang>: <text>"
  const m1 = text.match(/^translate\s+(.+?)\s+(?:to|into|in)\s+(\w+)$/)
  if (m1) {
    return {
      score: 24,
      fn: async () => ({
        message: `Translating to ${m1[2]}.`,
        action: A.translate(m1[1].trim(), m1[2].trim())
      })
    }
  }
  const m2 = text.match(/^say\s+(.+?)\s+in\s+(\w+)$/)
  if (m2) {
    return {
      score: 24,
      fn: async () => ({
        message: `Saying that in ${m2[2]}.`,
        action: A.translate(m2[1].trim(), m2[2].trim())
      })
    }
  }
  return null
})

// ── help ────────────────────────────────────────────────────────────────────
def('help.tour', (text) => /^(?:help me|show help|open help|welcome tour|tour|guide me|how do i use this|teach me)$/.test(text)
  ? { score: 18, fn: async () => ({ message: 'Opening the welcome tour.', action: A.helpTour() }) }
  : null)

// ── math ────────────────────────────────────────────────────────────────────
def('math', (text) => {
  const m = nlp.extractMath(text)
  if (!m) return null
  return {
    score: 22,
    fn: async () => ({ message: `${m.expr} equals ${m.result}.` })
  }
})

// ── status questions ────────────────────────────────────────────────────────
def('status.openWindows', (text) => {
  if (!/\b(what'?s open|which apps are open|what apps|list windows|show windows)\b/.test(text)) return null
  return {
    score: 18,
    fn: async (ctx) => {
      const open = ctx.osState?.openWindows || []
      if (!open.length) return { message: 'No apps are open right now.' }
      return { message: `You have ${open.length} app${open.length === 1 ? '' : 's'} open: ${open.join(', ')}.` }
    }
  }
})

// ── small talk ──────────────────────────────────────────────────────────────
const SMALL_TALK = {
  greeting:    ['Hi there. How can I help?', 'Hello. What would you like to do?', 'Hey. Just tell me what you need.'],
  farewell:    ['Take care.', 'Goodbye for now.', 'Bye, talk soon.'],
  thanks:      ["You're welcome.", 'Happy to help.', 'Anytime.'],
  identity:    ["I'm Spirit, the assistant built into SpiritOS. I work fully offline."],
  capability:  ["I can open apps, set or delete reminders, switch theme and font size, apply accessibility profiles, control windows, do simple math, search the web, take notes, translate text, navigate presentations, and trigger SOS. Try saying 'set a reminder at 9 to take medicine' or 'open the calculator'."],
  weather:     ["I don't have internet weather data offline. Open Browser and search 'weather' for live forecasts."],
  joke: [
    'Why did the computer go to therapy? Too many unresolved promises.',
    'I told my pillow my secrets. Now my dreams know everything.',
    'The keyboard was nervous before its big speech. Just couldn’t find the right words.',
    'Why was the calculator so popular? Everyone counted on it.'
  ],
  who_made: ['SpiritOS is a research project inspired by the FlexOS paper.']
}
def('smalltalk', (text) => {
  const v = nlp.scoreTopics(text, {
    greeting:    [['hello', 3], ['hi', 3], ['hey', 3], ['good morning', 4], ['good evening', 4], ['good afternoon', 4]],
    farewell:    [['goodbye', 4], ['bye', 3], ['see you', 3], ['see ya', 3]],
    thanks:      [['thank you', 4], ['thanks', 3], ['cheers', 2], ['appreciated', 2]],
    identity:    [['who are you', 5], ['what are you', 4], ['your name', 3], ['about you', 3]],
    capability:  [['what can you do', 5], ['help me', 2], ['features', 3], ['commands', 3]],
    weather:     [['weather', 4], ['rain', 3], ['temperature', 3], ['forecast', 3], ['hot today', 2]],
    joke:        [['joke', 4], ['funny', 3], ['make me laugh', 4]],
    who_made:    [['who made you', 5], ['who built', 4], ['flexos', 3]]
  })
  if (!v) return null
  return {
    score: 5 + v.score,  // small-talk loses to action intents
    fn: async () => ({ message: pick(SMALL_TALK[v.topic]) })
  }
})

// ── Slot-fill resolvers ─────────────────────────────────────────────────────
// When a previous turn parked a partial intent in `pending`, we use these
// resolvers to fill the missing slot from the next utterance.

async function resolvePending(rawText, pending, ctx) {
  if (!pending) return null
  const text = nlp.normalize(nlp.stripFillers(rawText))

  if (pending.intent === 'reminder.create') {
    if (pending.name === 'time') {
      const time = nlp.extractTime(text)
      if (!time) {
        return {
          message: 'I still need a time. Try saying "at 9 am" or "in five minutes".',
          slot: pending
        }
      }
      return saveReminder(pending.title, time, ctx)
    }
    if (pending.name === 'title') {
      const title = text.replace(/^(?:to|for)\s+/, '').trim()
      if (!title) {
        return {
          message: `What should I remind you about at ${nlp.fmt12(pending.time)}?`,
          slot: pending
        }
      }
      return saveReminder(title, pending.time, ctx)
    }
  }
  return null
}

// ── core dispatcher ─────────────────────────────────────────────────────────
function classify(text) {
  const candidates = []
  for (const intent of INTENTS) {
    try {
      const r = intent.scorer(text)
      if (r) candidates.push({ ...r, name: intent.name })
    } catch (err) {
      console.warn(`[Spirit] intent "${intent.name}" scorer threw:`, err.message)
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates
}

async function spirit(rawMessage, context, prisma) {
  const startedAt = Date.now()
  const sessionId = context.sessionId || 'anon'
  const osState   = context.osState   || {}

  // 1. Load conversation memory
  const session = await loadSession(prisma, sessionId)

  const cleaned = nlp.normalize(nlp.stripFillers(rawMessage))

  // 2. If there's a pending slot, decide whether the new utterance is a
  //    fresh command or a slot answer. A fresh command shows up as a
  //    high-scoring intent — if so we drop the pending slot.
  let result = null
  const ranked = classify(cleaned)
  const topNew = ranked[0]
  const isFresh = topNew && topNew.score >= 18

  if (session.pending && !isFresh) {
    result = await resolvePending(rawMessage, session.pending, { osState, prisma, sessionId })
    if (result?.slot) {
      // still waiting on the same slot — keep going
    }
  }

  // 3. If we didn't take the slot path, classify normally.
  if (!result && topNew) {
    try {
      result = await topNew.fn({ osState, prisma, sessionId, history: session.history })
    } catch (err) {
      console.error('[Spirit] handler error:', err)
      result = { message: "Sorry, something went wrong handling that. Try again." }
    }
  }

  // 4. Final fallback — friendly suggestion
  if (!result) {
    result = {
      message:
        `I didn't catch that. Try things like "open notes", "set a reminder ` +
        `at nine to take medicine", "switch to dark mode", "what's open?", ` +
        `"call for help", or "what gestures can I use?".`
    }
  }

  // 5. Persist the new pending slot (if any) and append to history
  session.pending = result.slot || null
  session.history.push({ role: 'user',      content: rawMessage,      ts: new Date().toISOString() })
  session.history.push({ role: 'assistant', content: result.message,  ts: new Date().toISOString(), action: result.action || null })
  saveSession(prisma, sessionId, session).catch(() => {})

  return {
    message:     cap1((result.message || '').trim()),
    action:      result.action || null,
    agent:       'spirit',
    duration_ms: Date.now() - startedAt
  }
}

module.exports = { spirit }

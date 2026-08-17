/**
 * server/lib/nlp.js
 *
 * Offline natural-language utilities for the Spirit assistant.
 *
 * Combines:
 *   • compromise — English NLP (POS tags, nouns, verbs)
 *   • fuse.js    — fuzzy substring search for app / profile / website names
 *   • chrono-node — natural-language date/time parser
 *                   ("tomorrow at 9", "in 5 minutes", "half past 3",
 *                    "next Monday morning", etc.)
 *
 * All functions are pure: no network, no LLM calls.
 */

const Fuse       = require('fuse.js')
const chrono     = require('chrono-node')

// ── canonical lists ──────────────────────────────────────────────────────────
const APPS = [
  { canonical: 'FileExplorer', aliases: ['files', 'file explorer', 'explorer', 'file manager', 'my files', 'documents'] },
  { canonical: 'Terminal',     aliases: ['terminal', 'console', 'command prompt', 'shell', 'cmd', 'bash'] },
  { canonical: 'Calculator',   aliases: ['calculator', 'calc', 'math', 'maths'] },
  { canonical: 'Notes',        aliases: ['notes', 'notepad', 'writer', 'editor', 'note', 'diary', 'journal'] },
  { canonical: 'Browser',      aliases: ['browser', 'web', 'internet', 'chrome', 'firefox', 'edge', 'safari'] },
  { canonical: 'Settings',     aliases: ['settings', 'preferences', 'options', 'configuration', 'config'] },
  { canonical: 'Translator',   aliases: ['translator', 'translate', 'language tool', 'translation'] },
  { canonical: 'Presentation', aliases: ['presentation', 'slides', 'slideshow', 'deck', 'powerpoint'] },
  { canonical: 'Reminders',    aliases: ['reminders', 'reminder', 'alarms', 'alarm', 'tasks', 'todo', 'to-do'] },
  { canonical: 'Emergency',    aliases: ['sos contacts', 'emergency contacts', 'sos', 'emergency', 'help contacts'] },
  { canonical: 'Mail',         aliases: ['mail', 'email', 'inbox', 'gmail'] },
  { canonical: 'KnownBook',    aliases: ['known book', 'people', 'contacts book', 'family book', 'address book'] }
]

const PROFILES = [
  { canonical: 'default',            aliases: ['default', 'normal', 'standard', 'regular'] },
  { canonical: 'elderly',            aliases: ['elderly', 'senior', 'older', 'grandma', 'grandpa', 'grandparent'] },
  { canonical: 'visually-impaired',  aliases: ['visually impaired', 'visually-impaired', 'low vision', 'cant see', 'blind', 'poor vision'] },
  { canonical: 'motor-impaired',     aliases: ['motor impaired', 'motor-impaired', 'tremors', 'shaky', 'mobility', 'parkinsons', "parkinson's"] },
  { canonical: 'beginner',           aliases: ['beginner', 'newbie', 'starter', 'simple', 'easy'] }
]

const SITE_LIST = [
  { url: 'https://www.youtube.com',    name: 'YouTube',   aliases: ['youtube', 'yt'] },
  { url: 'https://www.google.com',     name: 'Google',    aliases: ['google'] },
  { url: 'https://mail.google.com',    name: 'Gmail',     aliases: ['gmail'] },
  { url: 'https://github.com',         name: 'GitHub',    aliases: ['github'] },
  { url: 'https://www.reddit.com',     name: 'Reddit',    aliases: ['reddit'] },
  { url: 'https://www.wikipedia.org',  name: 'Wikipedia', aliases: ['wikipedia', 'wiki'] },
  { url: 'https://open.spotify.com',   name: 'Spotify',   aliases: ['spotify'] },
  { url: 'https://www.netflix.com',    name: 'Netflix',   aliases: ['netflix'] },
  { url: 'https://www.linkedin.com',   name: 'LinkedIn',  aliases: ['linkedin'] },
  { url: 'https://www.amazon.com',     name: 'Amazon',    aliases: ['amazon'] },
  { url: 'https://twitter.com',        name: 'Twitter',   aliases: ['twitter', 'x'] },
  { url: 'https://www.instagram.com',  name: 'Instagram', aliases: ['instagram', 'insta'] },
  { url: 'https://www.whatsapp.com',   name: 'WhatsApp',  aliases: ['whatsapp', 'whats app'] }
]

// Build flat fuzzy-search arrays once at module load.
const APP_INDEX     = APPS.flatMap(a => a.aliases.map(alias => ({ alias, canonical: a.canonical })))
const PROFILE_INDEX = PROFILES.flatMap(p => p.aliases.map(alias => ({ alias, canonical: p.canonical })))
const SITE_INDEX    = SITE_LIST.flatMap(s => s.aliases.map(alias => ({ alias, url: s.url, name: s.name })))

const FUSE_OPTS = { includeScore: true, threshold: 0.32, keys: ['alias'] }
const appFuse     = new Fuse(APP_INDEX,     FUSE_OPTS)
const profileFuse = new Fuse(PROFILE_INDEX, FUSE_OPTS)
const siteFuse    = new Fuse(SITE_INDEX,    FUSE_OPTS)

// ── helpers ──────────────────────────────────────────────────────────────────
function normalize(text) {
  return (text || '').toString()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/[!?.,;:]+$/, '')
    .trim()
}

const pad2 = (n) => String(n).padStart(2, '0')

/**
 * Extract a clock time from natural-language input using chrono-node.
 *
 * Returns:
 *   { hh, mm, raw, when }       — when = JS Date for the next firing
 *   or null
 *
 * Handles "tomorrow at 8", "in 5 minutes", "half past 3", "next Monday morning",
 * "9", "9 am", "9:30 pm", "noon", "midnight" — anything chrono understands.
 */
function extractTime(text) {
  const s = normalize(text)
  if (!s) return null

  // Handle simple noon/midnight first (chrono parses them but we want the raw label)
  if (/\bnoon|midday\b/.test(s))  return { hh: 12, mm: 0, raw: 'noon',     when: dateAt(12, 0) }
  if (/\bmidnight\b/.test(s))     return { hh: 0,  mm: 0, raw: 'midnight', when: dateAt(0, 0) }

  // chrono.parse returns an array of matches with .start and .text
  let parsed
  try { parsed = chrono.parse(s, new Date(), { forwardDate: true }) }
  catch (_) { return null }
  if (!parsed?.length) return null

  // Take the first time-bearing match
  const match = parsed.find((p) => p.start.isCertain('hour') || p.start.knownValues.hour != null)
                   || parsed[0]

  const when = match.start.date()
  if (!(when instanceof Date) || isNaN(when)) return null

  return { hh: when.getHours(), mm: when.getMinutes(), raw: match.text, when }
}

function dateAt(hh, mm) {
  const d = new Date()
  d.setHours(hh, mm, 0, 0)
  if (d <= new Date()) d.setDate(d.getDate() + 1)
  return d
}

/** Format a {hh,mm} as "HH:mm" for the API. */
function fmt24(t) { return `${pad2(t.hh)}:${pad2(t.mm)}` }

/** Format a {hh,mm} as 12-hour with am/pm — friendly for TTS. */
function fmt12(t) {
  const m = pad2(t.mm)
  if (t.hh === 0)  return `12:${m} AM`
  if (t.hh === 12) return `12:${m} PM`
  if (t.hh < 12)   return `${t.hh}:${m} AM`
  return `${t.hh - 12}:${m} PM`
}

/**
 * Fuzzy app extraction. Stricter than the website matcher so we don't
 * confuse "amazon" with "Notes". Returns canonical name or null.
 */
function extractApp(text) {
  const s = normalize(text)
  if (!s) return null
  // Direct substring on each alias for speed and accuracy.
  for (const a of APPS) {
    for (const alias of a.aliases) {
      if (s.includes(alias)) return a.canonical
    }
  }
  // Fallback to fuzzy match — but only if the input looks short (one or two
  // words), otherwise we get false positives on long sentences.
  if (s.split(' ').length <= 3) {
    const r = appFuse.search(s)
    if (r.length && r[0].score < 0.25) return r[0].item.canonical
  }
  return null
}

function extractProfile(text) {
  const s = normalize(text)
  if (!s) return null
  for (const p of PROFILES) {
    for (const alias of p.aliases) if (s.includes(alias)) return p.canonical
  }
  if (s.split(' ').length <= 4) {
    const r = profileFuse.search(s)
    if (r.length && r[0].score < 0.25) return r[0].item.canonical
  }
  return null
}

function extractTheme(text) {
  const s = normalize(text)
  if (/\b(dark|night|black)\b/.test(s)) return 'dark'
  if (/\b(light|day|bright|white)\b/.test(s)) return 'light'
  return null
}

function extractFontSize(text) {
  const s = normalize(text)
  if (/\b(extra large|xl|huge|biggest|largest|very large|massive)\b/.test(s)) return 'xl'
  if (/\b(large|big|bigger|larger|enlarge|increase|grow)\b/.test(s)) return 'large'
  if (/\b(small|smaller|reduce|shrink|normal|default|reset)\b/.test(s)) return 'normal'
  return null
}

function extractWebsite(text) {
  const s = normalize(text)
  if (!s) return null
  for (const site of SITE_LIST) {
    for (const alias of site.aliases) {
      if (s.includes(alias)) return { url: site.url, name: site.name }
    }
  }
  // Bare domain
  const bare = s.match(/\b([a-z0-9-]+\.[a-z]{2,}(?:\/[\w/-]*)?)\b/)
  if (bare) {
    const url = bare[1].startsWith('http') ? bare[1] : `https://${bare[1]}`
    return { url, name: bare[1] }
  }
  if (s.split(' ').length <= 3) {
    const r = siteFuse.search(s)
    if (r.length && r[0].score < 0.25) return { url: r[0].item.url, name: r[0].item.name }
  }
  return null
}

function extractSearchQuery(text) {
  const s = normalize(text)
  const m = s.match(/^(?:search(?: for)?|google|look up|find|find me|tell me about)\s+(.+)$/)
  return m ? m[1].trim() : null
}

/** Math expression detector — "what is 3 + 4 * 2" etc. */
function extractMath(text) {
  const s = normalize(text)
  // Pull off question prefix
  const stripped = s
    .replace(/^(?:what(?:'s| is)|whats|calculate|compute|solve|tell me|how much is)\s*/, '')
    .replace(/[?!.]+$/, '')
    .trim()
  if (!stripped) return null

  // Translate words to operators BEFORE we whitelist-check
  let expr = stripped
    .replace(/\bx\b|\btimes\b|\bmultiplied by\b/g, '*')
    .replace(/\bdivided by\b|\bover\b/g, '/')
    .replace(/\bplus\b|\bsum of\b/g, '+')
    .replace(/\bminus\b/g, '-')
    .replace(/\bsquared\b/g, '**2')
    .replace(/\bcubed\b/g, '**3')
    .replace(/\bto the power of?\s*(\d+)/g, '**$1')
    .replace(/(\d+)\s*percent of\s*(\d+(?:\.\d+)?)/g, '($1/100)*$2')
    .replace(/(\d+)\s*%\s*of\s*(\d+(?:\.\d+)?)/g, '($1/100)*$2')
    .replace(/\bpercent\b|%/g, '/100')
    .replace(/\s+/g, '')

  // Whitelist: digits, basic operators, parens, asterisks, decimal point
  if (!/^[\d+\-*/().]+$/.test(expr)) return null
  if (!/[+\-*/]/.test(expr)) return null
  // Must contain at least one digit on each side of an operator
  if (!/\d.*[+\-*/].*\d/.test(expr)) return null

  try {
    const result = Function(`"use strict"; return (${expr});`)()
    if (!Number.isFinite(result)) return null
    // Round to 6 decimal places to avoid 0.30000000000004 noise
    const rounded = Math.round(result * 1e6) / 1e6
    return { expr: stripped, result: rounded }
  } catch {
    return null
  }
}

/** "10 minutes", "2 hours" → milliseconds. */
function parseDuration(text) {
  const s = normalize(text)
  const m = s.match(/(\d{1,3})\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  if (/^s/.test(m[2])) return n * 1000
  if (/^m/.test(m[2])) return n * 60_000
  return n * 3_600_000
}

/**
 * Score-based keyword voting. Each topic is an array of weighted keywords:
 *   { topic: [['keyword', weight], ...] }
 * Returns the topic with the highest accumulated score (or null).
 */
function scoreTopics(text, lex) {
  const s = ' ' + normalize(text) + ' '
  const scores = {}
  for (const topic of Object.keys(lex)) {
    let total = 0
    for (const entry of lex[topic]) {
      const [kw, w = 1] = Array.isArray(entry) ? entry : [entry, 1]
      // Prefer word boundaries so "art" doesn't match inside "smart"
      const re = new RegExp(`(?:^|\\W)${escapeRe(kw)}(?:$|\\W)`, 'i')
      if (re.test(s)) total += w
    }
    if (total > 0) scores[topic] = total
  }
  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  return winner ? { topic: winner[0], score: winner[1] } : null
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

/**
 * Strip filler words from the user input so the rest of the parsers don't
 * have to handle "please could you possibly" prefixes.
 */
function stripFillers(text) {
  return normalize(text)
    .replace(/^(?:please|hey|hi|ok(?:ay)?|spirit|computer|assistant|hello)[,]?\s+/, '')
    .replace(/^(?:could you|can you|would you|i want to|i'd like to|i wanna|can u)\s+/, '')
    .replace(/^(?:please|kindly)\s+/, '')
    .replace(/\s+(?:please|for me|now|now please|right now)\s*$/, '')
    .trim()
}

module.exports = {
  normalize, stripFillers, pad2, fmt24, fmt12, escapeRe,
  extractTime, extractApp, extractProfile, extractTheme, extractFontSize,
  extractWebsite, extractSearchQuery, extractMath, parseDuration,
  scoreTopics,
  APPS, PROFILES, SITE_LIST
}

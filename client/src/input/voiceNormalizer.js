import {
  APP_ALIASES,
  CLOSE_VERBS,
  FILLER_PHRASES,
  OPEN_VERBS,
  PHRASE_REPLACEMENTS
} from './voicePhraseDictionary.js'

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function phrasePattern(phrases) {
  return phrases
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')
}

function cleanFillerWords(text) {
  const fillerPattern = phrasePattern(FILLER_PHRASES)
  return text.replace(new RegExp(`(?:^|\\s)(?:${fillerPattern})(?=\\s|$)`, 'giu'), ' ')
}

export function normalizeVoiceCommand(input) {
  if (typeof input !== 'string') return ''
  let text = input.toLowerCase().trim().replace(/[.,!?।]+/gu, ' ')
  text = cleanFillerWords(text).replace(/\s+/gu, ' ').trim()
  if (!text) return ''

  for (const { phrase, canonical } of APP_ALIASES) {
    const app = escapeRegExp(phrase).replace(/\s+/g, '\\s+')
    const openVerb = phrasePattern(OPEN_VERBS)
    const closeVerb = phrasePattern(CLOSE_VERBS)
    text = text
      .replace(new RegExp(`^(${app})\\s+(?:${openVerb})$`, 'iu'), `open ${canonical}`)
      .replace(new RegExp(`^(?:${openVerb})\\s+(${app})$`, 'iu'), `open ${canonical}`)
      .replace(new RegExp(`^(${app})\\s+(?:${closeVerb})$`, 'iu'), `close ${canonical}`)
  }

  const replacements = PHRASE_REPLACEMENTS
    .map(({ phrases, replacement }) => ({ pattern: phrasePattern(phrases), replacement }))
    .sort((a, b) => b.pattern.length - a.pattern.length)
  for (const { pattern, replacement } of replacements) {
    text = text.replace(new RegExp(pattern, 'giu'), replacement)
  }

  const openVerb = phrasePattern(OPEN_VERBS)
  const closeVerb = phrasePattern(CLOSE_VERBS)
  text = text
    .replace(new RegExp(`^(?:${openVerb})$`, 'iu'), 'open')
    .replace(new RegExp(`^(?:${closeVerb})$`, 'iu'), 'close window')
    .replace(/\bremind me to\s+(?:mujhe|मुझे)\s+/iu, 'remind me to ')
    .replace(/\s+/gu, ' ')
    .trim()

  return text
}

import {
  APP_ALIASES,
  CLOSE_VERBS,
  FILLER_PHRASES,
  FUZZY_COMMAND_KEYWORDS,
  OPEN_VERBS,
  PHRASE_REPLACEMENTS,
  STOP_VERBS
} from './voicePhraseDictionary.js'

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeScriptVariants(value) {
  return value
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/gu, '')
    .normalize('NFD')
    .replace(/़/gu, '')
    .normalize('NFC')
    .replace(/ऑ/gu, 'ओ')
    .replace(/ॉ/gu, 'ो')
    .replace(/(?<=[\u0915-\u0939])ओ/gu, 'ो')
    .replace(/[ॅैॆ]/gu, 'े')
    .replace(/ँ/gu, 'ं')
    .replace(/्/gu, '')
    .toLowerCase()
}

function cleanPunctuation(text) {
  return text.replace(/\p{P}/gu, (punctuation, index, input) => {
    if (punctuation === ':' && /\d/u.test(input[index - 1] || '') && /\d/u.test(input[index + 1] || '')) {
      return ':'
    }
    return ' '
  })
}

function normalizePhrase(value) {
  return cleanPunctuation(normalizeScriptVariants(value))
    .replace(/\s+/gu, ' ')
    .trim()
}

function phrasePattern(phrases) {
  return phrases
    .map(normalizePhrase)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')
}

function replaceStandalonePhrase(text, phrase, replacement) {
  const pattern = escapeRegExp(normalizePhrase(phrase)).replace(/\s+/gu, '\\s+')
  return text.replace(new RegExp(`(^|\\s)(?:${pattern})(?=\\s|$)`, 'giu'), (_, prefix) => `${prefix}${replacement}`)
}

function replacePhraseGroups(text, groups) {
  const replacements = groups
    .map(({ phrases, replacement }) => ({
      pattern: phrasePattern(phrases),
      replacement
    }))
    .sort((a, b) => b.pattern.length - a.pattern.length)

  for (const { pattern, replacement } of replacements) {
    text = text.replace(new RegExp(`(^|\\s)(?:${pattern})(?=\\s|$)`, 'giu'), (_, prefix) => `${prefix}${replacement}`)
  }
  return text
}

function normalizeAppAliases(text) {
  const aliases = [...APP_ALIASES].sort((a, b) => b.phrase.length - a.phrase.length)
  for (const { phrase, canonical } of aliases) {
    text = replaceStandalonePhrase(text, phrase, canonical)
  }
  return text
}

function normalizeAppVerbOrder(text) {
  const appNames = [...new Set(APP_ALIASES.map(({ canonical }) => canonical))]
    .sort((a, b) => b.length - a.length)
  const apps = phrasePattern(appNames)
  const opens = phrasePattern(OPEN_VERBS)
  const closes = phrasePattern(CLOSE_VERBS)
  const stops = phrasePattern(STOP_VERBS)

  for (const [pattern, command] of [
    [`^(${apps})\\s+(?:${opens})$`, 'open'],
    [`^(?:${opens})\\s+(${apps})$`, 'open'],
    [`^(${apps})\\s+(?:${closes})$`, 'close'],
    [`^(?:${closes})\\s+(${apps})$`, 'close'],
    [`^(${apps})\\s+(?:${stops})$`, 'stop'],
    [`^(?:${stops})\\s+(${apps})$`, 'stop']
  ]) {
    text = text.replace(new RegExp(pattern, 'iu'), (_, app) => `${command} ${app}`)
  }
  return text
}

function editDistance(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const previous = row[j]
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1)
      )
      diagonal = previous
    }
  }
  return row[right.length]
}

export function fuzzyNormalizeVoiceCommand(input) {
  if (typeof input !== 'string') return ''
  const keywords = [...new Set([
    ...APP_ALIASES.map(({ canonical }) => canonical.split(' ')).flat(),
    ...FUZZY_COMMAND_KEYWORDS
  ])].filter((word) => word.length >= 5)

  return input.split(/\s+/u).map((token) => {
    if (token.length < 5 || keywords.includes(token)) return token
    const threshold = 1
    let bestDistance = threshold + 1
    let bestMatches = []
    for (const keyword of keywords) {
      if (Math.abs(keyword.length - token.length) > threshold) continue
      const distance = editDistance(token, keyword)
      if (distance < bestDistance) {
        bestDistance = distance
        bestMatches = [keyword]
      } else if (distance === bestDistance) {
        bestMatches.push(keyword)
      }
    }
    return bestDistance <= threshold && bestMatches.length === 1 ? bestMatches[0] : token
  }).join(' ')
}

export function normalizeVoiceCommand(input) {
  if (typeof input !== 'string') return ''
  let text = normalizePhrase(input)
  text = cleanPunctuation(text).replace(/\s+/gu, ' ').trim()
  if (!text) return ''

  text = replacePhraseGroups(text, [{
    phrases: FILLER_PHRASES,
    replacement: ''
  }])
  text = normalizeAppAliases(text)
  text = replacePhraseGroups(text, PHRASE_REPLACEMENTS)
  text = replacePhraseGroups(text, PHRASE_REPLACEMENTS)
  text = normalizeAppVerbOrder(text)

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

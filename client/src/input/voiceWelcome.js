import { VOICE_ACTION_PHRASES } from './voiceActionPhrases.js'
import { getVoiceString } from './voiceLocalization.js'

const LANGUAGE_KEYS = {
  english: ['en', ', ', ', or '],
  hindi: ['hi', ', ', ', या '],
  marathi: ['mr', ', ', ', किंवा '],
  tamil: ['ta', ', ', ', அல்லது ']
}

const EXAMPLE_ACTIONS = ['app.open', 'reminder.create', 'appearance.theme', 'system.time', 'help.list']

export function getGreetingBucket(date = new Date()) {
  const hour = date instanceof Date ? date.getHours() : Number(date)
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

export function getWelcomeExamples(language = 'english') {
  const key = ({ english: 'en', hindi: 'hi', marathi: 'mr', tamil: 'ta' })[language] || 'en'
  return EXAMPLE_ACTIONS.map((actionId) => VOICE_ACTION_PHRASES[actionId]?.[key]?.[0]?.text).filter(Boolean)
}

function getGreeting(bucket, language) {
  const key = ({ morning: 'welcomeMorning', afternoon: 'welcomeAfternoon', evening: 'welcomeEvening', night: 'welcomeNight' })[bucket]
  return getVoiceString(key, language)
}

export function getWelcomeMessage(language = 'english', date = new Date()) {
  const selectedLanguage = LANGUAGE_KEYS[language] ? language : 'english'
  const [, separator, lastSeparator] = LANGUAGE_KEYS[selectedLanguage]
  const examples = getWelcomeExamples(selectedLanguage)
  const exampleList = examples.length > 1
    ? `${examples.slice(0, -1).join(separator)}${lastSeparator}${examples.at(-1)}`
    : examples[0] || ''
  return `${getGreeting(getGreetingBucket(date), selectedLanguage)} ${getVoiceString('welcomeIntro', selectedLanguage)}: ${exampleList}.`
}

export function getWelcomeHelpText(language = 'english') {
  const selectedLanguage = LANGUAGE_KEYS[language] ? language : 'english'
  const [, separator, lastSeparator] = LANGUAGE_KEYS[selectedLanguage]
  const examples = getWelcomeExamples(selectedLanguage)
  const exampleList = examples.length > 1
    ? `${examples.slice(0, -1).join(separator)}${lastSeparator}${examples.at(-1)}`
    : examples[0] || ''
  return `${getVoiceString('welcomeIntro', selectedLanguage)}: ${exampleList}.`
}

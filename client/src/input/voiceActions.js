import ACTION_REGISTRY from '../../../shared/voice-action-registry.json' with { type: 'json' }
import { VOICE_ACTION_PHRASES } from './voiceActionPhrases.js'
import { executeIntent, parseIntent } from './voiceIntents.js'
import { fuzzyNormalizeVoiceCommand, normalizeVoiceCommand } from './voiceNormalizer.js'
import { parseReminderUtterance } from './voiceReminderParser.js'
import { parseTranslateRequest } from './voiceTranslationParser.js'

export const VOICE_ACTIONS = ACTION_REGISTRY
const ACTIONS_BY_ID = new Map(VOICE_ACTIONS.map((action) => [action.id, action]))
const LOCALIZED_PHRASE_INDEX = Object.entries(VOICE_ACTION_PHRASES).flatMap(([id, languages]) =>
  Object.values(languages).flatMap((phrases) => phrases.map(({ text, params }) => ({
    id,
    text: normalizeVoiceCommand(text).toLowerCase(),
    params
  })))
)

const INTENT_ACTIONS = {
  'reminder.create': (args) => ({ id: 'reminder.create', params: { title: args.title, time: args.time } }),
  'reminder.delete': (args) => ({ id: 'reminder.delete', params: { match: args.match } }),
  'reminder.list': () => ({ id: 'reminder.list', params: {} }),
  'sos.trigger': () => ({ id: 'emergency.sos', params: {} }),
  'theme.set': (args) => ({ id: 'appearance.theme', params: { value: args.theme } }),
  'font.set': (args) => ({ id: 'appearance.font_size', params: { value: args.size } }),
  'profile.apply': (args) => ({ id: 'accessibility.profile', params: { profile: args.profile } }),
  'window.open': (args) => ({ id: 'app.open', params: { app: args.app } }),
  'window.close': (args) => ({ id: 'window.close_app', params: { app: args.app } }),
  'window.closeActive': () => ({ id: 'window.close_active', params: {} }),
  'window.closeAll': () => ({ id: 'window.close_all', params: {} }),
  'window.minimize': () => ({ id: 'window.minimize', params: {} }),
  'window.maximize': () => ({ id: 'window.maximize', params: {} }),
  'window.desktop': () => ({ id: 'window.show_desktop', params: {} }),
  'window.next': () => ({ id: 'window.switch', params: { direction: 'next' } }),
  'window.prev': () => ({ id: 'window.switch', params: { direction: 'previous' } }),
  'system.time': () => ({ id: 'system.time', params: {} }),
  'system.date': () => ({ id: 'system.date', params: {} }),
  'system.battery': () => ({ id: 'system.battery', params: {} }),
  'system.refresh': () => ({ id: 'system.refresh', params: {} }),
  'system.scrollDown': () => ({ id: 'system.scroll', params: { direction: 'down' } }),
  'system.scrollUp': () => ({ id: 'system.scroll', params: { direction: 'up' } }),
  'presentation.next': () => ({ id: 'presentation.control', params: { command: 'next' } }),
  'presentation.prev': () => ({ id: 'presentation.control', params: { command: 'previous' } }),
  'presentation.read': () => ({ id: 'presentation.control', params: { command: 'read' } }),
  'presentation.close': () => ({ id: 'presentation.control', params: { command: 'close' } }),
  'web.search': (args) => ({ id: 'web.search', params: { query: args.query } }),
  'web.youtube': (args) => ({ id: 'web.youtube', params: { query: args.query } }),
  'help.tour': () => ({ id: 'help.tour', params: {} }),
  'help.list': () => ({ id: 'help.list', params: {} })
}

export function voiceIntentToAction(intent) {
  const convert = intent && INTENT_ACTIONS[intent.intent]
  return convert ? convert(intent.args || {}) : null
}

export function matchVoiceRequest(transcript, language = 'english') {
  const reminder = parseReminderUtterance(transcript, language)
  if (reminder.status === 'complete') {
    return { normalizedText: normalizeVoiceCommand(transcript), match: reminder.action, route: 'rule' }
  }
  if (reminder.status === 'clarify') {
    return { normalizedText: normalizeVoiceCommand(transcript), match: null, route: null, clarification: reminder.reply }
  }

  let normalizedText = normalizeVoiceCommand(transcript)
  let match = findLocalizedVoiceAction(normalizedText)
  let intent = parseIntent(normalizedText)
  if (!match) match = intent ? voiceIntentToAction(intent) : null
  let route = match ? 'rule' : null

  if (!match) {
    match = findStructuredVoiceAction(transcript)
    if (match) route = 'rule'
  }

  if (!match) {
    match = findFastVoiceAction(normalizedText)
    if (match) route = match.route
  }
  if (!match) {
    const fuzzyText = fuzzyNormalizeVoiceCommand(normalizedText)
    if (fuzzyText !== normalizedText) {
      normalizedText = fuzzyText
      intent = parseIntent(fuzzyText)
      match = intent ? voiceIntentToAction(intent) : findFastVoiceAction(fuzzyText)
      if (match) route = 'fuzzy'
    }
  }
  return { normalizedText, match, route }
}

function findStructuredVoiceAction(rawText) {
  const translation = parseTranslateRequest(rawText)
  if (translation) {
    return {
      id: 'translator.open',
      params: { text: translation.text, target: translation.target },
      route: 'rule'
    }
  }

  const folderPath = parseFolderRequest(rawText)
  if (folderPath) {
    return { id: 'file.open', params: { path: folderPath, directory: true }, route: 'rule' }
  }

  const urlCommand = String(rawText || '').normalize('NFC').trim()
    .match(/^(?:open|visit|go to)\s+(https?:\/\/\S+|(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?)$/iu)
  if (urlCommand) {
    const candidate = urlCommand[1].replace(/[.,!?;:]+$/u, '')
    const url = /^https?:\/\//iu.test(candidate) ? candidate : `https://${candidate}`
    try {
      if (['http:', 'https:'].includes(new URL(url).protocol)) {
        return { id: 'web.open', params: { url }, route: 'rule' }
      }
    } catch {
      return null
    }
  }
  return null
}

function parseFolderRequest(input) {
  if (typeof input !== 'string') return null
  const text = input.normalize('NFC').replace(/[।॥!?]+/gu, ' ').replace(/\s+/gu, ' ').trim()
  const names = [
    { path: 'Documents', aliases: ['documents', 'document', 'दस्तावेज़', 'दस्तावेज', 'कागदपत्रे', 'कागदपत्र', 'ஆவணங்கள்', 'ஆவணம்'] },
    { path: 'Desktop', aliases: ['desktop', 'डेस्कटॉप', 'டெஸ்க்டாப்'] },
    { path: 'Downloads', aliases: ['downloads', 'download', 'डाउनलोड', 'डाउनलोड्स', 'பதிவிறக்கங்கள்'] }
  ]
  const folderSuffix = /(?:\s+(?:folder|फ़ोल्डर|फोल्डर|கோப்புறை|கோப்புறையை))?$/iu
  const commandPatterns = [
    /^(?:open|open the|go to|show|ओपन|ஓபன்)\s+(.+)$/iu,
    /^(.+?)\s+(?:खोलो|खोलें|खोल दो|दिखाओ|पर जाओ)$/iu,
    /^(.+?)\s+(?:उघडा|उघड|दाखवा|मध्ये जा)$/iu,
    /^(.+?)\s+(?:திற|திறக்கவும்|காட்டு|செல்)$/iu
  ]
  let name = ''
  for (const pattern of commandPatterns) {
    const match = text.match(pattern)
    if (match) {
      name = match[1].replace(folderSuffix, '').trim()
      break
    }
  }
  if (!name) return null
  const normalizedName = name.toLocaleLowerCase()
  const known = names.find(({ aliases }) => aliases.some((alias) =>
    alias.normalize('NFC').toLocaleLowerCase() === normalizedName
  ))
  const safeName = (known?.path || name).trim()
  if (!safeName || safeName.length > 80 || /[\\/:.]/u.test(safeName) ||
      safeName === '.' || safeName === '..' || safeName.includes('..')) return null
  return `/${safeName}`
}

export function validateVoiceAction(actionId, params) {
  const action = ACTIONS_BY_ID.get(actionId)
  if (!action) return { valid: false, error: 'Unknown voice action.' }
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return { valid: false, error: 'Action params must be an object.' }
  }
  const definitions = action.params || {}
  if (Object.keys(params).some((key) => !Object.hasOwn(definitions, key))) {
    return { valid: false, error: 'Action contains unsupported parameters.' }
  }
  for (const [name, definition] of Object.entries(definitions)) {
    const value = params[name]
    if (value === undefined) {
      if (definition.required) return { valid: false, error: `Missing parameter: ${name}` }
      continue
    }
    if (typeof value !== definition.type || (definition.type === 'number' && !Number.isFinite(value))) {
      return { valid: false, error: `Invalid parameter: ${name}` }
    }
    if (definition.enum && !definition.enum.includes(value)) {
      return { valid: false, error: `Invalid parameter value: ${name}` }
    }
    if (definition.maxLength && value.length > definition.maxLength) {
      return { valid: false, error: `Parameter is too long: ${name}` }
    }
    if (definition.minLength && value.length < definition.minLength) {
      return { valid: false, error: `Parameter is too short: ${name}` }
    }
    if (definition.minimum !== undefined && value < definition.minimum) {
      return { valid: false, error: `Invalid parameter value: ${name}` }
    }
    if (definition.maximum !== undefined && value > definition.maximum) {
      return { valid: false, error: `Invalid parameter value: ${name}` }
    }
  }
  if (actionId === 'media.volume' && params.direction === undefined && params.level === undefined) {
    return { valid: false, error: 'Volume direction or level is required.' }
  }
  if (actionId === 'web.open') {
    try {
      const url = new URL(params.url)
      if (!['http:', 'https:'].includes(url.protocol)) return { valid: false, error: 'Only web URLs can be opened.' }
    } catch {
      return { valid: false, error: 'A valid web URL is required.' }
    }
  }
  if (actionId === 'file.open' && params.directory) {
    if (/\\|:|(?:^|\/)\.\.(?:\/|$)/u.test(params.path) || !params.path.startsWith('/')) {
      return { valid: false, error: 'Folder path must remain inside the filesystem root.' }
    }
  }
  return { valid: true, action }
}

function editDistance(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const previous = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1))
      diagonal = previous
    }
  }
  return row[right.length]
}

export function findFastVoiceAction(normalizedText) {
  const text = normalizedText.trim().toLowerCase()
  if (!text) return null

  const localizedMatch = findLocalizedVoiceAction(text)
  if (localizedMatch) return localizedMatch

  for (const action of VOICE_ACTIONS) {
    const match = action.phrases.find(({ text: phrase }) => text === phrase)
    if (match) return { id: action.id, params: match.params, route: 'rule' }
  }
  for (const action of VOICE_ACTIONS) {
    const match = action.phrases.find(({ text: phrase }) => phrase.length > 3 && text.includes(phrase))
    if (match) return { id: action.id, params: match.params, route: 'rule' }
  }

  const tokens = text.split(/\s+/u)
  for (const action of VOICE_ACTIONS) {
    for (const phrase of action.phrases) {
      const expected = phrase.text.split(/\s+/u)
      if (expected.length !== tokens.length) continue
      let differences = 0
      let valid = true
      for (let index = 0; index < expected.length; index += 1) {
        if (expected[index] === tokens[index]) continue
        if (expected[index].length < 5 || tokens[index].length < 5 ||
            Math.abs(expected[index].length - tokens[index].length) > 1 ||
            editDistance(expected[index], tokens[index]) !== 1) {
          valid = false
          break
        }
        differences += 1
      }
      if (valid && differences === 1) {
        return { id: action.id, params: phrase.params, route: 'fuzzy' }
      }
    }
  }
  return null
}

function findLocalizedVoiceAction(text) {
  const localizedMatch = LOCALIZED_PHRASE_INDEX.find((phrase) => phrase.text === text)
  if (localizedMatch) return { id: localizedMatch.id, params: localizedMatch.params, route: 'rule' }
  return null
}

export async function executeVoiceAction(actionId, params, ctx) {
  const validated = validateVoiceAction(actionId, params)
  if (!validated.valid) throw new Error(validated.error)
  const { action } = validated

  switch (action.executor) {
    case 'openApp': ctx.openApp(params.app); break
    case 'closeApp': ctx.closeApp(params.app); break
    case 'closeActive': ctx.closeActive(); break
    case 'closeAll': ctx.closeAll(); break
    case 'minimizeActive': ctx.minimizeActive(); break
    case 'maximizeActive': ctx.maximizeActive(); break
    case 'switchWindow':
      if (params.app) ctx.switchWindow(params.app)
      else if (params.direction === 'previous') ctx.focusPrev()
      else ctx.focusNext()
      break
    case 'showDesktop': ctx.showDesktop(); break
    case 'setTheme': ctx.setTheme(params.value); break
    case 'setFontSize': ctx.setFontSize(params.value); break
    case 'setFontWeight': ctx.setFontWeight(params.value); break
    case 'setContrast': ctx.setContrast(params.value); break
    case 'setCursorSize': ctx.setCursorSize(params.value); break
    case 'setWallpaper': ctx.setWallpaper(params.value); break
    case 'applyProfile': ctx.applyProfile(params.profile); break
    case 'setVoiceLanguage': ctx.setVoiceLanguage(params.language); break
    case 'setSupportPhase': ctx.setSupportPhase(params.phase); break
    case 'zoom':
      if (params.direction === 'in') ctx.zoomIn()
      else if (params.direction === 'out') ctx.zoomOut()
      else ctx.zoomReset()
      break
    case 'toggleMute': ctx.toggleMute(params.muted); break
    case 'adjustVolume':
      if (params.level !== undefined) ctx.setVolume(params.level)
      else ctx.adjustVolume(params.direction === 'up' ? 0.1 : -0.1)
      break
    case 'toggleFeature': ctx.toggleFeature(params.feature, params.enabled); break
    case 'executeIntent': {
      const intent = action.executor.split(':')[1]
      if (intent === 'help.list') return ctx.speakHelp()
      return executeIntent({ intent, args: params }, {
        openApp: ctx.openApp,
        closeActive: ctx.closeActive,
        closeAll: ctx.closeAll,
        minimizeActive: ctx.minimizeActive,
        maximizeActive: ctx.maximizeActive,
        showDesktop: ctx.showDesktop,
        focusNext: ctx.focusNext,
        focusPrev: ctx.focusPrev,
        speakOut: ctx.speakHelp,
        addNotification: ctx.addNotification,
        setTheme: ctx.setTheme,
        setFontSize: ctx.setFontSize,
        applyProfile: ctx.applyProfile,
        closeAppByName: ctx.closeApp,
        presentationDispatch: ctx.presentationDispatch,
        googleSearch: ctx.searchWeb,
        openYouTube: ctx.playOnYouTube,
        openHelpTour: ctx.openHelpTour,
        listVoiceCommands: ctx.speakHelp,
        triggerSOS: ctx.triggerSOS
      })
    }
    case 'presentationDispatch':
      ctx.presentationDispatch(params.command === 'previous' ? 'prev' : params.command)
      break
    case 'fileSearch': return ctx.fileSearch(params.query, params.path)
    case 'fileCreate': return ctx.fileCreate(params)
    case 'fileOpen': return params.directory
      ? ctx.fileNavigate(params.path)
      : ctx.fileOpen(params.path)
    case 'fileRename': return ctx.fileRename(params)
    case 'fileMove': return ctx.fileMove(params)
    case 'fileCopy': return ctx.fileCopy(params)
    case 'fileDelete': return ctx.fileDelete(params.path)
    case 'greeting': break
    case 'triggerSOS': return ctx.triggerSOS()
    case 'searchWeb': ctx.searchWeb(params.query); break
    case 'playOnYouTube': ctx.playOnYouTube(params.query); break
    case 'openUrl': ctx.openUrl(params.url); break
    case 'openHelpTour': await ctx.openHelpTour(); break
    case 'speakHelp': return ctx.speakHelp()
    case 'tellTime': return ctx.getTimeReply()
    case 'tellDate': return ctx.getDateReply()
    case 'tellBattery': return ctx.getBatteryReply()
    case 'refresh': ctx.refresh(); break
    case 'scroll': window.scrollBy(0, params.direction === 'down' ? 300 : -300); break
    case 'translateText': ctx.translateText(params.text, params.target || null); break
    default: throw new Error(`No executor is registered for ${actionId}.`)
  }
  return null
}

const ACTION_REPLIES = {
  english: {
    'file.open': 'Opening the file.',
    'file.rename': 'Renamed the file.',
    'file.move': 'Moved the file.',
    'file.copy': 'Copied the file.',
    'file.delete': 'Moved the file to Trash.'
  },
  hindi: {
    'app.open': 'ऐप खोल रहा हूँ।',
    'window.close_active': 'विंडो बंद कर दी।',
    'window.close_app': 'ऐप बंद कर दिया।',
    'window.close_all': 'सभी विंडो बंद कर दीं।',
    'window.minimize': 'विंडो मिनिमाइज़ कर दी।',
    'window.maximize': 'विंडो मैक्सिमाइज़ कर दी।',
    'window.switch': 'विंडो बदल दी।',
    'window.show_desktop': 'डेस्कटॉप दिखा रहा हूँ।',
    'appearance.theme': 'थीम बदल दी।',
    'appearance.font_size': 'फ़ॉन्ट का आकार बदल दिया।',
    'appearance.font_weight': 'फ़ॉन्ट की मोटाई बदल दी।',
    'appearance.contrast': 'कंट्रास्ट बदल दिया।',
    'appearance.cursor_size': 'कर्सर का आकार बदल दिया।',
    'appearance.wallpaper': 'वॉलपेपर बदल दिया।',
    'voice.language': 'वॉइस भाषा बदल दी।',
    'accessibility.support_phase': 'सहायता स्तर बदल दिया।',
    'accessibility.profile': 'एक्सेसिबिलिटी प्रोफ़ाइल लागू कर दी।',
    'accessibility.zoom': 'ज़ूम बदल दिया।',
    'media.mute': 'ऑडियो सेटिंग बदल दी।',
    'media.volume': 'वॉल्यूम बदल दिया।',
    'feature.toggle': 'सेटिंग अपडेट कर दी।',
    'reminder.create': 'रिमाइंडर बना दिया।',
    'reminder.list': 'आपके रिमाइंडर दिखा रहा हूँ।',
    'reminder.delete': 'रिमाइंडर हटा दिया।',
    'presentation.control': 'प्रेज़ेंटेशन अपडेट कर दिया।',
    'file.search': 'फ़ाइलें खोज रहा हूँ।',
    'file.create': 'फ़ाइल या फ़ोल्डर बना दिया।',
    'file.open': 'फ़ाइल खोल रहा हूँ।',
    'file.rename': 'फ़ाइल का नाम बदल दिया।',
    'file.move': 'फ़ाइल स्थानांतरित कर दी।',
    'file.copy': 'फ़ाइल की कॉपी बना दी।',
    'file.delete': 'फ़ाइल को ट्रैश में भेज दिया।',
    'emergency.sos': 'एसओएस काउंटडाउन शुरू कर रहा हूँ।',
    'web.open': 'वेबसाइट खोल रहा हूँ।',
    'web.search': 'वेब पर खोज रहा हूँ।',
    'web.youtube': 'YouTube पर खोज रहा हूँ।',
    'help.tour': 'वेलकम टूर खोल रहा हूँ।',
    'help.list': 'वॉइस कमांड बता रहा हूँ।',
    'system.time': 'अभी का समय बता रहा हूँ।',
    'system.date': 'आज की तारीख बता रहा हूँ।',
    'system.battery': 'बैटरी की जानकारी बता रहा हूँ।',
    'system.refresh': 'पेज रीफ़्रेश कर रहा हूँ।',
    'system.scroll': 'पेज स्क्रॉल कर रहा हूँ।',
    'translator.open': 'ट्रांसलेटर खोल रहा हूँ।',
    'assistant.greeting': 'नमस्ते! मैं आपकी क्या मदद कर सकता हूँ?'
  },
  marathi: {
    'app.open': 'अॅप उघडत आहे.',
    'window.close_active': 'विंडो बंद केली.',
    'window.close_app': 'अॅप बंद केले.',
    'window.close_all': 'सर्व विंडो बंद केल्या.',
    'window.minimize': 'विंडो मिनिमाइझ केली.',
    'window.maximize': 'विंडो मॅक्सिमाइझ केली.',
    'window.switch': 'विंडो बदलली.',
    'window.show_desktop': 'डेस्कटॉप दाखवत आहे.',
    'appearance.theme': 'थीम बदलली.',
    'appearance.font_size': 'फॉन्टचा आकार बदलला.',
    'appearance.font_weight': 'फॉन्टची जाडी बदलली.',
    'appearance.contrast': 'कॉन्ट्रास्ट बदलला.',
    'appearance.cursor_size': 'कर्सरचा आकार बदलला.',
    'appearance.wallpaper': 'वॉलपेपर बदलला.',
    'voice.language': 'व्हॉइस भाषा बदलली.',
    'accessibility.support_phase': 'सहाय्य पातळी बदलली.',
    'accessibility.profile': 'अॅक्सेसिबिलिटी प्रोफाइल लागू केली.',
    'accessibility.zoom': 'झूम बदलला.',
    'media.mute': 'ऑडिओ सेटिंग बदलली.',
    'media.volume': 'आवाजाची पातळी बदलली.',
    'feature.toggle': 'सेटिंग अपडेट केली.',
    'reminder.create': 'रिमाइंडर तयार केला.',
    'reminder.list': 'तुमचे रिमाइंडर दाखवत आहे.',
    'reminder.delete': 'रिमाइंडर हटवला.',
    'presentation.control': 'प्रेझेंटेशन अपडेट केले.',
    'file.search': 'फाइल शोधत आहे.',
    'file.create': 'फाइल किंवा फोल्डर तयार केले.',
    'file.open': 'फाइल उघडत आहे.',
    'file.rename': 'फाइलचे नाव बदलले.',
    'file.move': 'फाइल हलवली.',
    'file.copy': 'फाइलची प्रत तयार केली.',
    'file.delete': 'फाइल कचरापेटीत टाकली.',
    'emergency.sos': 'एसओएस काउंटडाउन सुरू करत आहे.',
    'web.open': 'वेबसाइट उघडत आहे.',
    'web.search': 'वेबवर शोधत आहे.',
    'web.youtube': 'YouTube वर शोधत आहे.',
    'help.tour': 'वेलकम टूर उघडत आहे.',
    'help.list': 'व्हॉइस कमांड सांगत आहे.',
    'system.time': 'आत्ताची वेळ सांगत आहे.',
    'system.date': 'आजची तारीख सांगत आहे.',
    'system.battery': 'बॅटरीची माहिती सांगत आहे.',
    'system.refresh': 'पेज रीफ्रेश करत आहे.',
    'system.scroll': 'पेज स्क्रोल करत आहे.',
    'translator.open': 'ट्रान्सलेटर उघडत आहे.',
    'assistant.greeting': 'नमस्कार! मी तुम्हाला कशी मदत करू?'
  },
  tamil: {
    'app.open': 'செயலியை திறக்கிறேன்.',
    'window.close_active': 'சாளரம் மூடப்பட்டது.',
    'window.close_app': 'செயலி மூடப்பட்டது.',
    'window.close_all': 'அனைத்து சாளரங்களும் மூடப்பட்டன.',
    'window.minimize': 'சாளரம் சிறிதாக்கப்பட்டது.',
    'window.maximize': 'சாளரம் பெரிதாக்கப்பட்டது.',
    'window.switch': 'சாளரம் மாற்றப்பட்டது.',
    'window.show_desktop': 'டெஸ்க்டாப் காட்டப்படுகிறது.',
    'appearance.theme': 'தீம் மாற்றப்பட்டது.',
    'appearance.font_size': 'எழுத்து அளவு மாற்றப்பட்டது.',
    'appearance.font_weight': 'எழுத்தின் தடிமன் மாற்றப்பட்டது.',
    'appearance.contrast': 'கான்ட்ராஸ்ட் மாற்றப்பட்டது.',
    'appearance.cursor_size': 'கர்சர் அளவு மாற்றப்பட்டது.',
    'appearance.wallpaper': 'வால்பேப்பர் மாற்றப்பட்டது.',
    'voice.language': 'குரல் மொழி மாற்றப்பட்டது.',
    'accessibility.support_phase': 'உதவி நிலை மாற்றப்பட்டது.',
    'accessibility.profile': 'அணுகல்தன்மை சுயவிவரம் செயல்படுத்தப்பட்டது.',
    'accessibility.zoom': 'ஜூம் மாற்றப்பட்டது.',
    'media.mute': 'ஒலி அமைப்பு மாற்றப்பட்டது.',
    'media.volume': 'ஒலியளவு மாற்றப்பட்டது.',
    'feature.toggle': 'அமைப்பு புதுப்பிக்கப்பட்டது.',
    'reminder.create': 'நினைவூட்டல் உருவாக்கப்பட்டது.',
    'reminder.list': 'உங்கள் நினைவூட்டல்கள் காட்டப்படுகின்றன.',
    'reminder.delete': 'நினைவூட்டல் நீக்கப்பட்டது.',
    'presentation.control': 'விளக்கக்காட்சி கட்டுப்படுத்தப்பட்டது.',
    'file.search': 'கோப்புகள் தேடப்படுகின்றன.',
    'file.create': 'கோப்பு அல்லது கோப்புறை உருவாக்கப்பட்டது.',
    'file.open': 'கோப்பு திறக்கப்படுகிறது.',
    'file.rename': 'கோப்பின் பெயர் மாற்றப்பட்டது.',
    'file.move': 'கோப்பு நகர்த்தப்பட்டது.',
    'file.copy': 'கோப்பின் நகல் உருவாக்கப்பட்டது.',
    'file.delete': 'கோப்பு குப்பைக்கு நகர்த்தப்பட்டது.',
    'emergency.sos': 'அவசர எஸ்ஓஎஸ் கவுண்ட்டவுன் தொடங்குகிறது.',
    'web.open': 'இணையதளம் திறக்கப்படுகிறது.',
    'web.search': 'இணையத்தில் தேடப்படுகிறது.',
    'web.youtube': 'யூடியூப்பில் தேடப்படுகிறது.',
    'help.tour': 'வரவேற்பு வழிகாட்டி திறக்கப்படுகிறது.',
    'help.list': 'குரல் கட்டளைகள் கூறப்படுகின்றன.',
    'system.time': 'தற்போதைய நேரம்.',
    'system.date': 'இன்றைய தேதி.',
    'system.battery': 'பேட்டரி தகவல்.',
    'system.refresh': 'பக்கம் புதுப்பிக்கப்படுகிறது.',
    'system.scroll': 'பக்கம் நகர்த்தப்படுகிறது.',
    'translator.open': 'மொழிபெயர்ப்பி திறக்கப்படுகிறது.',
    'assistant.greeting': 'வணக்கம்! நான் உங்களுக்கு எப்படி உதவலாம்?'
  }
}

const GREETING_REPLIES = {
  english: {
    hello: 'Hello! How can I help you?',
    thanks: "You're welcome!"
  },
  hindi: {
    hello: 'नमस्ते! मैं आपकी क्या मदद कर सकता हूँ?',
    thanks: 'आपका स्वागत है!'
  },
  marathi: {
    hello: 'नमस्कार! मी तुम्हाला कशी मदत करू?',
    thanks: 'तुमचे स्वागत आहे!'
  },
  tamil: {
    hello: 'வணக்கம்! நான் உங்களுக்கு எப்படி உதவலாம்?',
    thanks: 'நன்றி! உங்களுக்கு உதவியதில் மகிழ்ச்சி.'
  }
}

export function getVoiceActionReply(actionId, language, fallback = '', params = {}) {
  if (actionId === 'assistant.greeting') {
    return GREETING_REPLIES[language]?.[params.kind] || GREETING_REPLIES.english.hello
  }
  if (actionId === 'file.open' && params.directory) {
    return ({
      english: 'Opening the folder.',
      hindi: 'फ़ोल्डर खोल रहा हूँ।',
      marathi: 'फोल्डर उघडत आहे.',
      tamil: 'கோப்புறையை திறக்கிறேன்.'
    })[language] || 'Opening the folder.'
  }
  if (actionId === 'help.list' && fallback) return fallback
  return ACTION_REPLIES[language]?.[actionId] || ACTION_REPLIES.english[actionId] || fallback
}

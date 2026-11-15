import test from 'node:test'
import assert from 'node:assert/strict'
import { fuzzyNormalizeVoiceCommand, normalizeVoiceCommand } from './voiceNormalizer.js'
import { parseIntent } from './voiceIntents.js'
import {
  getVoiceActionReply,
  matchVoiceRequest,
  validateVoiceAction,
  VOICE_ACTIONS
} from './voiceActions.js'
import { VOICE_ACTION_PHRASES } from './voiceActionPhrases.js'
import {
  confirmVoiceAction,
  getVoiceConfirmation,
  isVoiceConfirmation,
  requiresSpokenConfirmation
} from './voiceLocalization.js'
import { getVoiceLocalizationCoverage, getVoiceSystemReply } from './voiceLocalization.js'
import { normalizePlannerReminder, parseReminderUtterance } from './voiceReminderParser.js'
import { parseTranslateRequest } from './voiceTranslationParser.js'
import { getGreetingBucket, getWelcomeExamples, getWelcomeHelpText, getWelcomeMessage } from './voiceWelcome.js'

test('normalizes romanized Hindi app commands', () => {
  assert.equal(normalizeVoiceCommand('calculator kholo'), 'open calculator')
  assert.equal(normalizeVoiceCommand('notepad khol do'), 'open notepad')
})

test('normalizes Hindi app verbs in either word order', () => {
  assert.equal(normalizeVoiceCommand('ओपन कैलकुलेटर'), 'open calculator')
  assert.equal(normalizeVoiceCommand('कैलकुलेटर खोलो'), 'open calculator')
  assert.equal(normalizeVoiceCommand('कैलकुलेटर खोल दो'), 'open calculator')
  assert.equal(normalizeVoiceCommand('कैलकुलेटर चालू करो'), 'open calculator')
})

test('normalizes Marathi app verbs in either word order', () => {
  assert.equal(normalizeVoiceCommand('कॅल्क्युलेटर उघडा'), 'open calculator')
  assert.equal(normalizeVoiceCommand('कॅल्क्युलेटर सुरू करा'), 'open calculator')
  assert.equal(normalizeVoiceCommand('कॅल्क्युलेटर बंद करा'), 'close calculator')
})

test('normalizes Tamil app phrases, variants, and punctuation', () => {
  assert.equal(normalizeVoiceCommand('ஓபன் கால்குலேட்டர்॥'), 'open calculator')
  assert.equal(normalizeVoiceCommand('கால்குலேட்டர் திற'), 'open calculator')
  assert.equal(normalizeVoiceCommand('கால்குலேட்டர் மூடவும்।'), 'close calculator')
  assert.equal(normalizeVoiceCommand('  “கால்குலேட்டர்\u200d திற”   । '), 'open calculator')
  assert.equal(normalizeVoiceCommand('open calculator'), 'open calculator')
})

test('folds common calculator spellings and punctuation', () => {
  for (const spelling of ['कैलकुलेटर', 'कैल्कुलेटर', 'कॅल्क्युलेटर', 'कैलक्यूलेटर']) {
    assert.equal(normalizeVoiceCommand(`ओपन  ${spelling} ।`), 'open calculator')
  }
  for (const phrase of [
    'ओपन कैलकुलेटर',
    'कैलकुलेटर खोलो',
    'कैलकुलेटर खोल दो',
    'कैलकुलेटर चालू करो',
    'कॅल्क्युलेटर उघडा',
    'कॅल्क्युलेटर सुरू करा',
    'कॅल्क्युलेटर बंद करा'
  ]) {
    assert.equal(normalizeVoiceCommand(`  ${phrase}   ।  `), normalizeVoiceCommand(phrase))
  }
  assert.equal(normalizeVoiceCommand('  “ओपन, कैलकुलेटर” ।  '), 'open calculator')
  assert.equal(normalizeVoiceCommand('कैलकुलेटर\u200d खोलो॥'), 'open calculator')
  assert.equal(normalizeVoiceCommand('कैलकुलेटर खोलो'.normalize('NFD')), 'open calculator')
  assert.equal(normalizeVoiceCommand('open calculator, please'), 'open calculator')
})

test('normalizes Hindi and Marathi close and stop commands', () => {
  assert.equal(normalizeVoiceCommand('कैलकुलेटर बंद करो'), 'close calculator')
  assert.equal(normalizeVoiceCommand('कैलकुलेटर बंद कर दो'), 'close calculator')
  assert.equal(normalizeVoiceCommand('बंद करा'), 'close window')
  assert.equal(normalizeVoiceCommand('प्रेजेंटेशन रोक दो'), 'stop presentation')
  assert.equal(normalizeVoiceCommand('प्रेजेंटेशन थांबवा'), 'stop presentation')
})

test('normalizes Hindi and Marathi volume and reminder phrases', () => {
  assert.equal(normalizeVoiceCommand('आवाज़ बढ़ाओ'), 'increase volume')
  assert.equal(normalizeVoiceCommand('वॉल्यूम कम करो'), 'decrease volume')
  assert.equal(normalizeVoiceCommand('आवाज वाढवा'), 'increase volume')
  assert.equal(normalizeVoiceCommand('आवाज कमी करा'), 'decrease volume')
  assert.equal(normalizeVoiceCommand('मुझे याद दिलाओ medicine at 9'), 'remind me to medicine at 9')
  assert.equal(normalizeVoiceCommand('मला आठवण करून द्या medicine at 9'), 'remind me to medicine at 9')
})

test('asks the planner to clarify reminder deletion without a target', () => {
  assert.equal(matchVoiceRequest('delete reminder').match, null)
  assert.equal(matchVoiceRequest('delete reminder for water').match?.id, 'reminder.delete')
})

test('normalized Hindi and Marathi phrases reach executable intents', () => {
  for (const phrase of [
    'ओपन कैलकुलेटर',
    'कैलकुलेटर खोलो',
    'कैलकुलेटर खोल दो',
    'कैलकुलेटर चालू करो',
    'कॅल्क्युलेटर उघडा',
    'कॅल्क्युलेटर सुरू करा'
  ]) {
    assert.equal(parseIntent(normalizeVoiceCommand(phrase))?.intent, 'window.open')
  }
  assert.equal(parseIntent(normalizeVoiceCommand('कॅल्क्युलेटर बंद करा'))?.intent, 'window.close')
  assert.equal(parseIntent(normalizeVoiceCommand('मला आठवण करून द्या medicine at 9'))?.intent, 'reminder.create')
})

test('maps Devanagari app transliterations and preserves English commands', () => {
  const appPhrases = [
    ['फ़ाइल एक्सप्लोरर', 'FileExplorer'],
    ['फ़ाइल एक्सप्लोरर', 'FileExplorer'],
    ['कैलकुलेटर', 'Calculator'],
    ['कमांड प्रॉम्प्ट', 'Terminal'],
    ['नोटपैड', 'Notes'],
    ['ब्राउज़र', 'Browser'],
    ['सेटिंग्स', 'Settings'],
    ['ट्रांसलेटर', 'Translator'],
    ['प्रेजेंटेशन', 'Presentation'],
    ['रिमाइंडर', 'Reminders'],
    ['आपातकाल', 'Emergency'],
    ['मेल', 'Mail'],
    ['ज्ञात पुस्तक', 'KnownBook'],
    ['वॉल्ट', 'Vault'],
    ['पीडीएफ', 'PdfViewer'],
    ['इमेज', 'ImageViewer']
  ]
  for (const [phrase, app] of appPhrases) {
    assert.equal(parseIntent(normalizeVoiceCommand(`ओपन ${phrase}`))?.args.app, app)
  }
  assert.equal(normalizeVoiceCommand('ओपन नोटपैड'), 'open notepad')
  assert.equal(normalizeVoiceCommand('ओपन सेटिंग्स'), 'open settings')
  assert.equal(normalizeVoiceCommand('open settings'), 'open settings')
})

test('uses a conservative fuzzy correction before intent matching', () => {
  const fuzzy = fuzzyNormalizeVoiceCommand('open calculater')
  assert.equal(fuzzy, 'open calculator')
  assert.deepEqual(parseIntent(fuzzy), {
    intent: 'window.open',
    args: { app: 'Calculator' }
  })
  assert.equal(parseIntent(fuzzyNormalizeVoiceCommand('close calculater'))?.intent, 'window.close')
  assert.equal(fuzzyNormalizeVoiceCommand('open unrelated'), 'open unrelated')
  assert.equal(parseIntent(fuzzyNormalizeVoiceCommand('open unrelated')), null)
})

test('routes 12 English, Hindi, Marathi, and Tamil utterances to registered actions', () => {
  const examples = {
    english: [
      'open calculator', 'open notepad', 'open terminal', 'open browser',
      'open settings', 'close window', 'minimize', 'maximize', 'next slide',
      'show reminders', 'increase volume', 'dark mode'
    ],
    hindi: [
      'ओपन कैलकुलेटर', 'नोटपैड खोलो', 'टर्मिनल खोल दो', 'ब्राउज़र चालू करो',
      'सेटिंग्स खोलो', 'बंद करो', 'अगली स्लाइड', 'रिमाइंडर दिखाओ',
      'आवाज़ बढ़ाओ', 'आवाज़ कम करो', 'डार्क मोड', 'ज़ूम इन'
    ],
    marathi: [
      'कॅल्क्युलेटर उघडा', 'नोटपॅड उघडा', 'टर्मिनल सुरू करा', 'ब्राउझर उघडा',
      'सेटिंग्ज उघडा', 'बंद करा', 'पुढची स्लाइड', 'स्मरणपत्र दाखवा',
      'आवाज वाढवा', 'आवाज कमी करा', 'गडद मोड', 'झूम इन'
    ],
    tamil: [
      'கால்குலேட்டர் திற', 'நோட்ஸ் திறக்கவும்', 'டெர்மினல் தொடங்கு', 'பிரவுசர் திற',
      'செட்டிங்ஸ் திற', 'சாளரத்தை மூடு', 'சாளரத்தை சிறிதாக்கு', 'சாளரத்தை பெரிதாக்கு',
      'அடுத்த ஸ்லைடை காட்டு', 'என் நினைவூட்டல்களை காட்டு', 'ஒலியளவை அதிகரி', 'டார்க் தீமை அமை'
    ]
  }

  for (const [language, phrases] of Object.entries(examples)) {
    assert.equal(phrases.length, 12, `${language} should have at least 10 examples`)
    for (const phrase of phrases) {
      const { match } = matchVoiceRequest(phrase)
      assert.ok(match, `${language} phrase did not match: ${phrase}`)
    }
  }
})

test('every registry action has phrases for every selected language', () => {
  const actionIds = VOICE_ACTIONS.map(({ id }) => id)
  assert.deepEqual(Object.keys(VOICE_ACTION_PHRASES).sort(), [...actionIds].sort())
  for (const [actionId, languages] of Object.entries(VOICE_ACTION_PHRASES)) {
    for (const language of ['en', 'hi', 'mr', 'ta']) {
      assert.ok(languages[language].length >= 2, `${actionId} needs two ${language} phrases`)
    }
  }
})

test('voice language action supports Tamil and excludes the removed Hinglish mode', () => {
  for (const language of ['english', 'hindi', 'marathi', 'tamil']) {
    const phrase = VOICE_ACTION_PHRASES['voice.language'].en.find(({ params }) => params.language === language)
    assert.ok(phrase, `missing voice.language phrase for ${language}`)
    const { match } = matchVoiceRequest(phrase.text)
    assert.equal(match?.id, 'voice.language')
    assert.deepEqual(match.params, { language })
    assert.equal(validateVoiceAction('voice.language', { language }).valid, true)
  }
  assert.equal(validateVoiceAction('voice.language', { language: 'hinglish-auto' }).valid, false)
})

test('parses deterministic reminder requests across English, Hindi, Marathi, and Tamil', () => {
  const now = new Date(2026, 10, 10, 10, 0)
  const examples = {
    english: [
      ['remind me to take medicine at 5:25 PM', '17:25'],
      ['remind me to take medicine at five twenty five pm', '17:25'],
      ['remind me to take medicine in ten minutes', '10:10'],
      ['remind me to take medicine at noon', '12:00'],
      ['remind me to take medicine at half past five', '05:30'],
      ['remind me to take medicine at quarter to six', '05:45']
    ],
    hindi: [
      ['शाम 5:25 बजे दवा लेने का रिमाइंडर लगाओ', '17:25'],
      ['शाम ५:२५ बजे दवा लेने का रिमाइंडर लगाओ', '17:25'],
      ['सुबह पाँच बजकर पच्चीस मिनट दवा लेने की याद दिलाओ', '05:25'],
      ['दवा लेने का रिमाइंडर १० मिनट में लगाओ', '10:10'],
      ['दवा लेने की याद दोपहर १२ बजे दिलाओ', '12:00'],
      ['शाम साढ़े पाँच बजे दवा लेने का रिमाइंडर लगाओ', '17:30'],
      ['शाम पौने छह बजे दवा लेने की याद दिलाओ', '17:45']
    ],
    marathi: [
      ['संध्याकाळी 5:25 वाजता औषध घेण्याची आठवण करून दे', '17:25'],
      ['संध्याकाळी ५:२५ वाजता औषध घेण्याची आठवण करून दे', '17:25'],
      ['सकाळी पाच वाजून पंचवीस मिनिटे औषधाची आठवण करून दे', '05:25'],
      ['औषध घेण्याची आठवण १० मिनिटांनी करून दे', '10:10'],
      ['दुपारी बारा वाजता औषध घेण्याची आठवण करून दे', '12:00'],
      ['संध्याकाळी साडे पाच वाजता औषध घेण्याची आठवण करून दे', '17:30'],
      ['संध्याकाळी पावणे सहा वाजता औषध घेण्याची आठवण करून दे', '17:45']
    ],
    tamil: [
      ['மாலை 5:25 மணிக்கு மருந்து சாப்பிட நினைவூட்டல் அமை', '17:25'],
      ['மாலை ௫:௨௫ மணிக்கு மருந்து சாப்பிட நினைவூட்டல் அமை', '17:25'],
      ['காலை ஐந்து மணிக்கு இருபத்தைந்து நிமிடம் மருந்து நினைவூட்டு', '05:25'],
      ['மருந்து சாப்பிட ௧௦ நிமிடங்களில் நினைவூட்டல் அமை', '10:10'],
      ['மதியம் பன்னிரண்டு மணிக்கு மருந்து நினைவூட்டல் அமை', '12:00'],
      ['மாலை ஐந்து அரை மணிக்கு மருந்து நினைவூட்டல் அமை', '17:30'],
      ['மாலை ஆறு மணி கால் குறைவு மருந்து நினைவூட்டல் அமை', '17:45']
    ]
  }
  for (const [language, phrases] of Object.entries(examples)) {
    assert.ok(phrases.length >= 6)
    for (const [phrase, expectedTime] of phrases) {
      const result = parseReminderUtterance(phrase, language, now)
      assert.equal(result.status, 'complete', phrase)
      assert.equal(result.action.params.time, expectedTime, phrase)
      assert.ok(result.action.params.title.length > 0, phrase)
    }
  }
  assert.equal(parseReminderUtterance(examples.english[0][0], 'english', now).action.params.title, 'take medicine')
  assert.equal(parseReminderUtterance(examples.hindi[0][0], 'hindi', now).action.params.title, 'दवा लेने')
  assert.equal(parseReminderUtterance(examples.marathi[0][0], 'marathi', now).action.params.title, 'औषध घेण्याची')
  assert.equal(parseReminderUtterance(examples.tamil[0][0], 'tamil', now).action.params.title, 'மருந்து சாப்பிட')
  assert.equal(parseReminderUtterance('remind me about medicine', 'english').status, 'clarify')
  assert.equal(parseReminderUtterance('मुझे दवा की याद दिलाओ', 'hindi').status, 'clarify')
  assert.equal(parseReminderUtterance('औषधाची आठवण करून दे', 'marathi').status, 'clarify')
  assert.equal(parseReminderUtterance('மருந்தை நினைவூட்டு', 'tamil').status, 'clarify')
  assert.equal(parseReminderUtterance('remind me to take medicine at midnight', 'english').action.params.time, '00:00')
  assert.deepEqual(normalizePlannerReminder({ title: 'take medicine', time: '5:25 PM' }, 'english').params, {
    title: 'take medicine', time: '17:25'
  })
  assert.equal(normalizePlannerReminder({ title: 'medicine', time: '' }, 'tamil').valid, false)
})

test('parses translation requests and language aliases in all selected scripts', () => {
  const examples = [
    ['translate hello to Marathi', { text: 'hello', target: 'Marathi' }],
    ['अनुवाद करो hello को हिंदी', { text: 'hello', target: 'Hindi' }],
    ['hello चे तमिळमध्ये भाषांतर करा', { text: 'hello', target: 'Tamil' }],
    ['hello-ஐ ஹிந்திக்கு மொழிபெயர்', { text: 'hello', target: 'Hindi' }],
    ['translate bonjour to English', { text: 'bonjour', target: 'english' }],
    ['translate hello to French', { text: 'hello', target: 'French' }]
  ]
  for (const [phrase, expected] of examples) {
    assert.deepEqual(parseTranslateRequest(phrase), expected, phrase)
  }
  assert.equal(matchVoiceRequest('अनुवाद करो hello को हिंदी', 'hindi').match?.id, 'translator.open')
  assert.equal(matchVoiceRequest('hello चे तमिळमध्ये भाषांतर करा', 'marathi').match?.params.target, 'Tamil')
})

test('opens only safe root folders through the File Explorer route', () => {
  const examples = [
    ['open documents folder', 'english', '/Documents'],
    ['open desktop folder', 'english', '/Desktop'],
    ['open Projects', 'english', '/Projects'],
    ['दस्तावेज़ फ़ोल्डर खोलो', 'hindi', '/Documents'],
    ['डेस्कटॉप फ़ोल्डर खोलो', 'hindi', '/Desktop'],
    ['प्रोजेक्ट्स खोलो', 'hindi', '/प्रोजेक्ट्स'],
    ['कागदपत्रे फोल्डर उघडा', 'marathi', '/Documents'],
    ['डेस्कटॉप फोल्डर उघडा', 'marathi', '/Desktop'],
    ['प्रोजेक्ट्स उघडा', 'marathi', '/प्रोजेक्ट्स'],
    ['ஆவணங்கள் கோப்புறையை திற', 'tamil', '/Documents'],
    ['டெஸ்க்டாப் கோப்புறையை திற', 'tamil', '/Desktop'],
    ['திட்டங்கள் திற', 'tamil', '/திட்டங்கள்']
  ]
  for (const [phrase, language, path] of examples) {
    const { match } = matchVoiceRequest(phrase, language)
    assert.equal(match?.id, 'file.open', phrase)
    assert.deepEqual(match.params, { path, directory: true })
    assert.equal(validateVoiceAction(match.id, match.params).valid, true)
  }
  assert.equal(matchVoiceRequest('open C: folder', 'english').match, null)
  assert.equal(validateVoiceAction('file.open', { path: '/../../etc', directory: true }).valid, false)
})

test('localizes system replies and provides coverage for every reply and confirmation string', () => {
  for (const language of ['english', 'hindi', 'marathi', 'tamil']) {
    assert.ok(getVoiceSystemReply('time', language, '10:30').length > 0)
    assert.ok(getVoiceSystemReply('date', language, 'Monday').length > 0)
    assert.ok(getVoiceSystemReply('battery', language, '८०', false).length > 0)
  }
  assert.deepEqual(getVoiceLocalizationCoverage(), {
    english: [], hindi: [], marathi: [], tamil: []
  })
})

test('welcome greeting buckets and example commands are deterministic and routable', () => {
  const at = (hour) => new Date(2026, 0, 1, hour, 0)
  assert.equal(getGreetingBucket(at(5)), 'morning')
  assert.equal(getGreetingBucket(at(11)), 'morning')
  assert.equal(getGreetingBucket(at(12)), 'afternoon')
  assert.equal(getGreetingBucket(at(16)), 'afternoon')
  assert.equal(getGreetingBucket(at(17)), 'evening')
  assert.equal(getGreetingBucket(at(20)), 'evening')
  assert.equal(getGreetingBucket(at(21)), 'night')
  assert.equal(getGreetingBucket(at(4)), 'night')
  for (const language of ['english', 'hindi', 'marathi', 'tamil']) {
    const examples = getWelcomeExamples(language)
    assert.ok(examples.length >= 4 && examples.length <= 5)
    for (const phrase of examples) {
      assert.ok(matchVoiceRequest(phrase, language).match, `${language} welcome example did not route: ${phrase}`)
    }
    assert.ok(getWelcomeMessage(language, at(8)).length > 0)
    assert.equal(
      getVoiceActionReply('help.list', language, getWelcomeHelpText(language)),
      getWelcomeHelpText(language)
    )
  }
})

test('three phrases route for ten representative actions in all four languages', () => {
  const representativeIds = [
    'app.open', 'window.close_active', 'appearance.theme', 'media.volume',
    'reminder.list', 'presentation.control', 'file.search', 'file.create',
    'emergency.sos', 'system.time'
  ]
  for (const actionId of representativeIds) {
    for (const language of ['en', 'hi', 'mr', 'ta']) {
      for (const { text } of VOICE_ACTION_PHRASES[actionId][language].slice(0, 3)) {
        assert.equal(
          matchVoiceRequest(text).match?.id,
          actionId,
          `${language} phrase did not route for ${actionId}: ${text}`
        )
      }
    }
  }
})

test('risky action confirmation text and yes/no words are localized', () => {
  const fileCreate = VOICE_ACTIONS.find(({ id }) => id === 'file.create')
  assert.equal(fileCreate.risky, true)
  for (const language of ['english', 'hindi', 'marathi', 'tamil']) {
    assert.ok(getVoiceConfirmation('create a file', language).length > 0)
    let prompt = ''
    assert.equal(confirmVoiceAction('create a file', language, (message) => {
      prompt = message
      return true
    }), true)
    assert.ok(prompt.length > 0)
    assert.equal(confirmVoiceAction('create a file', language, () => false), false)
    assert.equal(isVoiceConfirmation(
      { english: 'yes', hindi: 'हाँ', marathi: 'हो', tamil: 'ஆம்' }[language],
      language
    ), true)
    assert.equal(isVoiceConfirmation(
      { english: 'no', hindi: 'नहीं', marathi: 'नाही', tamil: 'இல்லை' }[language],
      language
    ), false)
  }
})

test('all original fixed English commands route to a registry action', () => {
  const commands = {
    'presentation.control': [
      'next slide', 'next', 'forward', 'previous slide', 'previous', 'back', 'go back',
      'read this', 'read it', 'read aloud', 'read slide', 'play presentation',
      'auto play', 'autoplay', 'pause presentation', 'stop presentation', 'close slides', 'exit slides'
    ],
    'app.open': [
      'open file explorer', 'open files', 'open explorer', 'file manager', 'my files',
      'open calculator', 'calculator', 'calc', 'open terminal', 'terminal', 'command prompt', 'cmd',
      'open notes', 'notes', 'notepad', 'open notepad', 'open browser', 'browser',
      'open internet', 'internet', 'web browser', 'open settings', 'settings', 'preferences',
      'system settings', 'open translator', 'translator', 'translate', 'open presentations',
      'presentations', 'open slides', 'show slides', 'open presentation', 'open reminders',
      'reminders', 'show reminders', 'my reminders', 'open contacts', 'sos contacts',
      'emergency contacts'
    ],
    'window.close_active': ['close window', 'close this', 'close app', 'close it'],
    'window.close_all': ['close all', 'close everything', 'close all windows'],
    'window.minimize': ['minimize window', 'minimize this', 'minimize', 'hide window', 'hide this'],
    'window.maximize': ['maximize window', 'maximize this', 'maximize', 'full screen', 'fullscreen'],
    'window.show_desktop': ['show desktop', 'go to desktop', 'desktop', 'go home', 'home'],
    'accessibility.zoom': [
      ['zoom in', { direction: 'in' }],
      ['make bigger', { direction: 'in' }],
      ['increase size', { direction: 'in' }],
      ['larger text', { direction: 'in' }],
      ['zoom out', { direction: 'out' }],
      ['make smaller', { direction: 'out' }],
      ['decrease size', { direction: 'out' }],
      ['smaller text', { direction: 'out' }],
      ['normal zoom', { direction: 'reset' }],
      ['reset zoom', { direction: 'reset' }],
      ['default size', { direction: 'reset' }],
      ['normal size', { direction: 'reset' }]
    ],
    'system.time': ['what time is it', 'time', 'current time', 'tell me the time', 'what is the time'],
    'system.date': ['what date is it', 'date', 'today date', "today's date", 'what day is it'],
    'system.battery': ['battery', 'battery status', 'battery level', 'how much battery'],
    'media.mute': [
      ['mute', { muted: true }], ['mute audio', { muted: true }],
      ['mute sound', { muted: true }], ['silence', { muted: true }],
      ['unmute', { muted: false }], ['unmute audio', { muted: false }],
      ['sound on', { muted: false }], ['unmute sound', { muted: false }]
    ],
    'system.refresh': ['refresh', 'reload', 'restart'],
    'system.scroll': [
      ['scroll down', { direction: 'down' }], ['go down', { direction: 'down' }],
      ['page down', { direction: 'down' }], ['scroll up', { direction: 'up' }],
      ['go up', { direction: 'up' }], ['page up', { direction: 'up' }]
    ],
    'help.list': ['help', 'what can you do', 'commands', 'voice commands', 'list commands'],
    'help.tour': ['help me', 'show help', 'open help', 'welcome tour', 'tour'],
    'emergency.sos': ['call for help', 'emergency', 'call emergency', 'call sos', 'sos'],
    'assistant.greeting': [
      ['thank you', { kind: 'thanks' }], ['thanks', { kind: 'thanks' }], ['good job', { kind: 'thanks' }],
      ['hello', { kind: 'hello' }], ['hi', { kind: 'hello' }], ['hey', { kind: 'hello' }]
    ],
    'appearance.theme': [['dark mode', { value: 'dark' }]],
    'appearance.font_size': [['make text bigger', { value: 'large' }]],
    'accessibility.profile': [['elderly profile', { profile: 'elderly' }]],
    'reminder.create': [['remind me to take pill at 9 am', { title: 'take pill', time: '09:00' }]],
    'reminder.delete': [['delete reminder for water', { match: 'water' }]],
    'reminder.list': [['list my reminders', {}]],
    'window.close_app': [['close calculator', { app: 'Calculator' }]],
    'window.switch': [['next window', { direction: 'next' }]],
    'translator.open': [
      ['translate hello to Marathi', { text: 'hello', target: 'Marathi' }],
      ['translate in French hello', { text: 'hello', target: 'French' }]
    ],
    'web.youtube': [['play music on youtube', { query: 'music' }]],
    'web.search': [['search for groceries', { query: 'groceries' }]],
    'web.open': [
      ['open example.com', { url: 'https://example.com' }],
      ['open youtube', { url: 'https://www.youtube.com' }],
      ['open google', { url: 'https://www.google.com' }],
      ['open github', { url: 'https://github.com' }]
    ]
  }

  for (const [actionId, examples] of Object.entries(commands)) {
    for (const example of examples) {
      const [phrase, expectedParams] = Array.isArray(example) ? example : [example, undefined]
      const match = matchVoiceRequest(phrase).match
      assert.equal(match?.id, actionId, `Original command did not route: ${phrase}`)
      if (expectedParams) assert.deepEqual(match.params, expectedParams, phrase)
    }
  }
})

test('new file actions route with typed parameters in every language', () => {
  for (const actionId of ['file.open', 'file.rename', 'file.move', 'file.copy', 'file.delete']) {
    for (const language of ['en', 'hi', 'mr', 'ta']) {
      for (const { text, params } of VOICE_ACTION_PHRASES[actionId][language].slice(0, 3)) {
        const { match } = matchVoiceRequest(text)
        assert.equal(match?.id, actionId, `${language} phrase did not route: ${text}`)
        assert.deepEqual(match.params, params)
        assert.equal(validateVoiceAction(actionId, params).valid, true)
      }
    }
  }
})

test('all supported apps have rule-matcher phrases for open, close, and switch in four languages', () => {
  for (const actionId of ['app.open', 'window.close_app', 'window.switch']) {
    for (const language of ['en', 'hi', 'mr', 'ta']) {
      for (const { text, params } of VOICE_ACTION_PHRASES[actionId][language]) {
        const { match } = matchVoiceRequest(text)
        assert.equal(match?.id, actionId, `${language} phrase did not route: ${text}`)
        assert.equal(validateVoiceAction(actionId, params).valid, true)
      }
    }
  }
})

test('file delete, rename, and move require spoken confirmation in all languages', () => {
  for (const actionId of ['file.delete', 'file.rename', 'file.move']) {
    assert.equal(VOICE_ACTIONS.find(({ id }) => id === actionId)?.risky, true)
    assert.equal(requiresSpokenConfirmation(actionId), true)
  }
  assert.equal(requiresSpokenConfirmation('file.copy'), false)

  for (const language of ['english', 'hindi', 'marathi', 'tamil']) {
    for (const actionId of ['file.delete', 'file.rename', 'file.move']) {
      const prompt = getVoiceConfirmation('the file action', language, actionId)
      assert.match(prompt, /yes or no|हाँ या नहीं|हो किंवा नाही|ஆம் அல்லது இல்லை/iu)
    }
    assert.equal(isVoiceConfirmation('yes.', language), true)
    assert.equal(isVoiceConfirmation('no।', language), false)
  }
  assert.equal(
    getVoiceActionReply('assistant.greeting', 'english', '', { kind: 'thanks' }),
    "You're welcome!"
  )
})

test('removes fillers without changing ordinary English commands', () => {
  assert.equal(normalizeVoiceCommand('please ज़रा open calculator'), 'open calculator')
  assert.equal(normalizeVoiceCommand(null), '')
})

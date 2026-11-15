const VOICE_STRINGS = {
  english: {
    confirm: (description) => `Are you sure you want to ${description}? Choose Yes or No.`,
    cancelled: 'Action cancelled.',
    done: 'Done.',
    rateLimit: 'Voice request limit reached. Please try again in a minute.',
    requestError: 'I could not process that request just now. Please try again.',
    commandError: 'Voice command failed. Please try again.',
    welcomeMorning: 'Good morning.',
    welcomeAfternoon: 'Good afternoon.',
    welcomeEvening: 'Good evening.',
    welcomeNight: 'Hello.',
    welcomeIntro: "I'm your SpiritOS assistant. Try saying",
    systemTime: (time) => `The time is ${time}.`,
    systemDate: (date) => `Today is ${date}.`,
    systemBattery: (percent, charging) => `Battery is at ${percent} percent${charging ? ', and charging' : ''}.`,
    batteryUnavailable: 'Battery information is not available.',
    yes: ['yes', 'yeah', 'confirm'],
    no: ['no', 'cancel', 'stop']
  },
  hindi: {
    confirm: (description) => `क्या आप ${description} करना चाहते हैं? हाँ या नहीं चुनें।`,
    cancelled: 'कार्रवाई रद्द कर दी।',
    done: 'हो गया।',
    rateLimit: 'वॉइस अनुरोध सीमा पूरी हो गई है। कृपया एक मिनट बाद फिर कोशिश करें।',
    requestError: 'अभी अनुरोध समझने में समस्या है। कृपया फिर से कहें।',
    commandError: 'वॉइस कमांड पूरा नहीं हो सका। कृपया फिर से कोशिश करें।',
    welcomeMorning: 'सुप्रभात।',
    welcomeAfternoon: 'नमस्कार, शुभ दोपहर।',
    welcomeEvening: 'शुभ संध्या।',
    welcomeNight: 'नमस्कार।',
    welcomeIntro: 'मैं आपका SpiritOS सहायक हूँ। आज़माएँ',
    systemTime: (time) => `अभी समय ${time} है।`,
    systemDate: (date) => `आज ${date} है।`,
    systemBattery: (percent, charging) => `बैटरी ${percent} प्रतिशत है${charging ? ' और चार्ज हो रही है' : ''}।`,
    batteryUnavailable: 'बैटरी की जानकारी उपलब्ध नहीं है।',
    yes: ['हाँ', 'हां', 'जी हाँ'],
    no: ['नहीं', 'ना', 'रद्द करें']
  },
  marathi: {
    confirm: (description) => `${description} करायचे आहे का? हो किंवा नाही निवडा.`,
    cancelled: 'कृती रद्द केली.',
    done: 'झाले.',
    rateLimit: 'व्हॉइस विनंती मर्यादा पूर्ण झाली. कृपया एका मिनिटाने पुन्हा प्रयत्न करा.',
    requestError: 'सध्या विनंती समजण्यात अडचण आहे. कृपया पुन्हा सांगा.',
    commandError: 'व्हॉइस कमांड पूर्ण होऊ शकला नाही. कृपया पुन्हा प्रयत्न करा.',
    welcomeMorning: 'शुभ प्रभात।',
    welcomeAfternoon: 'नमस्कार, शुभ दुपार।',
    welcomeEvening: 'शुभ संध्याकाळ।',
    welcomeNight: 'नमस्कार।',
    welcomeIntro: 'मी तुमचा SpiritOS सहाय्यक आहे. असे बोलून पाहा',
    systemTime: (time) => `आत्ताची वेळ ${time} आहे.`,
    systemDate: (date) => `आजची तारीख ${date} आहे.`,
    systemBattery: (percent, charging) => `बॅटरी ${percent} टक्के आहे${charging ? ' आणि चार्ज होत आहे' : ''}.`,
    batteryUnavailable: 'बॅटरीची माहिती उपलब्ध नाही.',
    yes: ['हो', 'होय', 'नक्की'],
    no: ['नाही', 'नको', 'रद्द करा']
  },
  tamil: {
    confirm: (description) => `${description} செய்ய வேண்டுமா? ஆம் அல்லது இல்லை என்பதை தேர்ந்தெடுக்கவும்.`,
    cancelled: 'செயல் ரத்து செய்யப்பட்டது.',
    done: 'முடிந்தது.',
    rateLimit: 'குரல் கோரிக்கை வரம்பை எட்டிவிட்டது. ஒரு நிமிடம் கழித்து மீண்டும் முயற்சிக்கவும்.',
    requestError: 'கோரிக்கையைப் புரிந்துகொள்ள முடியவில்லை. மீண்டும் சொல்லுங்கள்.',
    commandError: 'குரல் கட்டளையைச் செயல்படுத்த முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    welcomeMorning: 'காலை வணக்கம்.',
    welcomeAfternoon: 'மதிய வணக்கம்.',
    welcomeEvening: 'மாலை வணக்கம்.',
    welcomeNight: 'வணக்கம்.',
    welcomeIntro: 'நான் உங்கள் SpiritOS உதவியாளர். இவ்வாறு சொல்லிப் பாருங்கள்',
    systemTime: (time) => `இப்போது நேரம் ${time}.`,
    systemDate: (date) => `இன்றைய தேதி ${date}.`,
    systemBattery: (percent, charging) => `மின்கலம் ${percent} சதவீதம்${charging ? ' மற்றும் சார்ஜ் ஆகிறது' : ''}.`,
    batteryUnavailable: 'மின்கலத் தகவல் கிடைக்கவில்லை.',
    yes: ['ஆம்', 'ஆமாம்', 'சரி'],
    no: ['இல்லை', 'வேண்டாம்', 'ரத்து செய்']
  }
}

export function getVoiceString(key, language, ...args) {
  const value = VOICE_STRINGS[language]?.[key] ?? VOICE_STRINGS.english[key]
  return typeof value === 'function' ? value(...args) : value
}

export function getVoiceSystemReply(kind, language, ...args) {
  const key = ({ time: 'systemTime', date: 'systemDate', battery: 'systemBattery' })[kind]
  return key ? getVoiceString(key, language, ...args) : ''
}

export function getVoiceLocalizationCoverage() {
  const keys = Object.keys(VOICE_STRINGS.english)
  return Object.fromEntries(Object.keys(VOICE_STRINGS).map((language) => [
    language,
    keys.filter((key) => !Object.hasOwn(VOICE_STRINGS[language], key))
  ]))
}

export function getVoiceConfirmation(description, language, actionId, params = {}) {
  const target = params.path || params.oldPath || params.sourcePath || 'this file'
  const destination = params.newName || params.destPath || 'the selected destination'
  const spokenConfirmations = {
    'file.delete': {
      english: `Move ${target} to Trash? Say yes or no.`,
      hindi: `क्या ${target} फ़ाइल को ट्रैश में भेज दूँ? हाँ या नहीं बोलें।`,
      marathi: `${target} फाइल कचरापेटीत टाकू का? हो किंवा नाही बोला.`,
      tamil: `${target} கோப்பை குப்பைக்கு நகர்த்தவா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.`
    },
    'file.rename': {
      english: `Rename ${target} to ${destination}? Say yes or no.`,
      hindi: `क्या ${target} का नाम ${destination} रख दूँ? हाँ या नहीं बोलें।`,
      marathi: `${target} चे नाव ${destination} ठेवू का? हो किंवा नाही बोला.`,
      tamil: `${target} கோப்பின் பெயரை ${destination} என மாற்றவா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.`
    },
    'file.move': {
      english: `Move ${target} to ${destination}? Say yes or no.`,
      hindi: `क्या ${target} को ${destination} पर ले जाऊँ? हाँ या नहीं बोलें।`,
      marathi: `${target} ला ${destination} येथे हलवू का? हो किंवा नाही बोला.`,
      tamil: `${target} கோப்பை ${destination} க்கு நகர்த்தவா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.`
    }
  }
  const spoken = spokenConfirmations[actionId]?.[language]
  if (spoken) return spoken
  return getVoiceString('confirm', language, description)
}

export function confirmVoiceAction(description, language, confirm = window.confirm.bind(window)) {
  return confirm(getVoiceConfirmation(description, language))
}

export function requiresSpokenConfirmation(actionId) {
  return ['file.delete', 'file.rename', 'file.move'].includes(actionId)
}

export function isVoiceConfirmation(text, language) {
  const value = text.normalize('NFC').trim().replace(/[.!?।॥]+$/u, '').toLocaleLowerCase()
  const strings = VOICE_STRINGS[language] || VOICE_STRINGS.english
  const yes = [...strings.yes, ...VOICE_STRINGS.english.yes]
  const no = [...strings.no, ...VOICE_STRINGS.english.no]
  if (yes.some((word) => value === word.normalize('NFC').toLocaleLowerCase())) return true
  if (no.some((word) => value === word.normalize('NFC').toLocaleLowerCase())) return false
  return null
}

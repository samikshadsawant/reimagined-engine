const DIGIT_FOLD = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  '௦': '0', '௧': '1', '௨': '2', '௩': '3', '௪': '4', '௫': '5', '௬': '6', '௭': '7', '௮': '8', '௯': '9'
}

const WORD_NUMBERS = {
  en: {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50
  },
  hi: {
    एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छः: 6, छह: 6, सात: 7, आठ: 8, नौ: 9, दस: 10,
    ग्यारह: 11, बारह: 12, तेरह: 13, चौदह: 14, पंद्रह: 15, पन्द्रह: 15, सोलह: 16, सत्रह: 17,
    अठारह: 18, उन्नीस: 19, बीस: 20, तीस: 30, चालीस: 40, पचास: 50, पच्चीस: 25, पैंतीस: 35,
    पैंतालीस: 45, पचपन: 55
  },
  mr: {
    एक: 1, दोन: 2, तीन: 3, चार: 4, पाच: 5, सहा: 6, सात: 7, आठ: 8, नऊ: 9, दहा: 10,
    अकरा: 11, बारा: 12, तेरा: 13, चौदा: 14, पंधरा: 15, सोळा: 16, सतरा: 17, अठरा: 18,
    एकोणीस: 19, वीस: 20, तीस: 30, चाळीस: 40, पन्नास: 50, पंचवीस: 25, पस्तीस: 35,
    पंचेचाळीस: 45, पंचावन्न: 55
  },
  ta: {
    ஒன்று: 1, ஒரு: 1, இரண்டு: 2, மூன்று: 3, நான்கு: 4, ஐந்து: 5, ஆறு: 6, ஏழு: 7, எட்டு: 8,
    ஒன்பது: 9, பத்து: 10, பதினொன்று: 11, பன்னிரண்டு: 12, பதின்மூன்று: 13, பதினான்கு: 14,
    பதினைந்து: 15, பதினாறு: 16, பதினேழு: 17, பதினெட்டு: 18, பத்தொன்பது: 19, இருபது: 20,
    முப்பது: 30, நாற்பது: 40, ஐம்பது: 50, இருபத்தைந்து: 25, முப்பத்தைந்து: 35,
    நாற்பத்தைந்து: 45, ஐம்பத்தைந்து: 55
  }
}

const DAY_PARTS = {
  en: { morning: 'am', afternoon: 'pm', evening: 'pm', night: 'pm' },
  hi: { सुबह: 'am', प्रातः: 'am', दोपहर: 'pm', शाम: 'pm', रात: 'pm' },
  mr: { सकाळी: 'am', दुपारी: 'pm', संध्याकाळी: 'pm', रात्री: 'pm' },
  ta: { காலை: 'am', மதியம்: 'pm', மாலை: 'pm', இரவு: 'pm' }
}

const REMINDER_CREATE_CUE = /(?:\bremind me\b|\bset\s+(?:a\s+)?reminder\b|\bset\s+(?:an?\s+)?alarm\b|\balarm\s+(?:for|at)\b|याद.*दिलाओ|याद.*दिलाएं|रिमाइंडर.*(?:लगाओ|लगाएं|बनाओ|सेट)|अलार्म.*(?:लगाओ|लगाएं|बनाओ|सेट)|आठवण.*करून दे|रिमाइंडर.*(?:लावा|लाव|सेट)|स्मरणपत्र.*(?:लावा|करा)|நினைவூட்டல்.*(?:அமை|வை)|நினைவூட்டு(?:ம்|வும்)?|அலாரம்.*அமை)/iu

const CLARIFICATIONS = {
  english: 'What should I remind you about, and at what time?',
  hindi: 'किस बात की याद दिलाऊँ और किस समय?',
  marathi: 'कशाची आठवण करून देऊ आणि कोणत्या वेळी?',
  tamil: 'எதை, எந்த நேரத்தில் நினைவூட்ட வேண்டும்?'
}

const languageKey = (language, text = '') => {
  if (language === 'hindi') return 'hi'
  if (language === 'marathi') return 'mr'
  if (language === 'tamil') return 'ta'
  if (/[\u0b80-\u0bff]/u.test(text)) return 'ta'
  if (/[\u0900-\u097f]/u.test(text)) return 'hi'
  return 'en'
}

function foldDigits(value) {
  return value.replace(/[०-९௦-௯]/gu, (digit) => DIGIT_FOLD[digit])
}

function numberAlternation(language) {
  const words = new Set(Object.keys(WORD_NUMBERS[language]))
  const numberEntries = Object.entries(WORD_NUMBERS[language])
  for (const [tens, tensValue] of numberEntries) {
    if (tensValue < 20 || tensValue % 10 !== 0) continue
    for (const [unit, unitValue] of numberEntries) {
      if (unitValue > 0 && unitValue < 10) {
        words.add(`${tens} ${unit}`)
        if (language === 'en') words.add(`${tens}-${unit}`)
      }
    }
  }
  return [...words]
    .sort((left, right) => right.length - left.length)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
    .join('|')
}

function numberValue(value, language) {
  if (/^\d+$/u.test(value)) return Number(value)
  const words = WORD_NUMBERS[language]
  value = value.replace(/-/gu, ' ')
  if (words[value] !== undefined) return words[value]
  const parts = value.split(/\s+/u)
  if (parts.length === 2 && words[parts[0]] >= 20 && words[parts[1]] < 10) {
    return words[parts[0]] + words[parts[1]]
  }
  return null
}

function localizedDayPart(text, language) {
  const entries = Object.entries(DAY_PARTS[language])
  const match = entries.find(([word]) => text.includes(word))
  if (match) return match[1]
  const ampm = text.match(/\b(am|a\.m\.|pm|p\.m\.)\b/iu)?.[1]?.replace(/\./gu, '').toLowerCase()
  return ampm || ''
}

function to24Hour(hour, minute, meridiem = '') {
  if (!Number.isInteger(hour) || hour < 0 || hour > 24 || !Number.isInteger(minute) || minute < 0 || minute > 59) return null
  if (meridiem) {
    if (hour < 1 || hour > 12) return null
    if (meridiem === 'pm' && hour < 12) hour += 12
    if (meridiem === 'am' && hour === 12) hour = 0
  } else if (hour === 24) {
    if (minute !== 0) return null
    hour = 0
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function parseTime(text, language, now = new Date()) {
  const source = foldDigits(text.normalize('NFC').toLowerCase())
  const dayPart = localizedDayPart(source, language)
  if (/\b(noon|midday)\b|दोपहर\s*(?:१२|12)?\s*बजे|மதிய(?:ம்)?\s*(?:12|பன்னிரண்டு)?\s*மணி/iu.test(source)) return '12:00'
  if (/\bmidnight\b|आधी\s*रात|मध्यरात्रि|मध्यरात्री|நள்ளிரவு/iu.test(source)) return '00:00'

  const relativeNumber = `(?:\\d{1,3}|${numberAlternation(language)})`
  const relativePatterns = language === 'en'
    ? new RegExp(`\\bin\\s+(${relativeNumber})\\s*(minutes?|mins?|hours?|hrs?)\\b`, 'iu')
    : language === 'hi'
      ? new RegExp(`(${relativeNumber})\\s*(?:मिनट|मिनटों|घंटे|घंटों)\\s*(?:में|बाद)`, 'iu')
      : language === 'mr'
        ? new RegExp(`(${relativeNumber})\\s*(?:मिनिटांनी|मिनिटांत|मिनिटात|मिनिटे?\\s*(?:मध्ये|नंतर|आत)|तास\\s*(?:मध्ये|नंतर|आत))`, 'iu')
        : new RegExp(`(${relativeNumber})\\s*(?:நிமிடங்களில்|நிமிடத்தில்|நிமிடங்கள்\\s*(?:பிறகு|கழித்து)|நிமிடம்\\s*(?:பிறகு|கழித்து)|மணிநேரத்தில்|மணி நேரத்தில்)`, 'iu')
  const relative = relativePatterns.exec(source)
  if (relative) {
    const amount = numberValue(relative[1], language)
    if (!amount || amount > 1440) return null
    const isHour = /hour|hr|घंट|तास|மணிநேர|மணி நேர/iu.test(relative[0])
    const result = new Date(now.getTime() + amount * (isHour ? 60 : 1) * 60_000)
    return `${String(result.getHours()).padStart(2, '0')}:${String(result.getMinutes()).padStart(2, '0')}`
  }

  const numbers = `\\d{1,2}|${numberAlternation(language)}`
  let match
  if (language === 'en') {
    match = /half\s+past\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)/iu.exec(source)
    if (match) return to24Hour(numberValue(match[1].toLowerCase(), language), 30, dayPart)
    match = /quarter\s+past\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)/iu.exec(source)
    if (match) return to24Hour(numberValue(match[1].toLowerCase(), language), 15, dayPart)
    match = /quarter\s+to\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)/iu.exec(source)
    if (match) return to24Hour((numberValue(match[1].toLowerCase(), language) + 11) % 12 || 12, 45, dayPart)
  }
  const halfLead = language === 'hi' ? 'साढ़े' : language === 'mr' ? 'साडे' : 'அரை'
  match = language === 'ta'
    ? new RegExp(`(${numbers})\\s*அரை`, 'u').exec(source) || new RegExp(`அரை\\s*(${numbers})`, 'u').exec(source)
    : new RegExp(`${halfLead}\\s*(${numbers})`, 'u').exec(source)
  if (match) {
    const hour = numberValue(match[1], language)
    return to24Hour(hour, 30, dayPart)
  }

  const quarterPast = language === 'hi' ? 'सव्वा' : language === 'mr' ? 'सव्वा' : null
  const quarterTo = language === 'hi' ? 'पौने' : language === 'mr' ? 'पावणे' : null
  if (quarterPast && (match = new RegExp(`${quarterPast}\\s*(${numbers})`, 'u').exec(source))) {
    return to24Hour(numberValue(match[1], language), 15, dayPart)
  }
  if (quarterTo && (match = new RegExp(`${quarterTo}\\s*(${numbers})`, 'u').exec(source))) {
    const nextHour = numberValue(match[1], language)
    return to24Hour((nextHour + 11) % 12 || 12, 45, dayPart)
  }
  if (language === 'ta') {
    match = new RegExp(`(${numbers})\\s*கால்`, 'u').exec(source)
    if (match) return to24Hour(numberValue(match[1], language), 15, dayPart)
    match = new RegExp(`(${numbers})\\s*மணி\\s*கால்\\s*குறைவு`, 'u').exec(source)
    if (match) return to24Hour((numberValue(match[1], language) + 11) % 12 || 12, 45, dayPart)
  }

  const clockPattern = new RegExp(
    `(${numbers})(?::(\\d{1,2})|\\s+(?:बजकर|वाजून|மணி(?:க்கு)?|hour(?:s)?(?:\\s+and)?|बजे|वाजता|மணிக்கு)\\s+(${numbers})(?:\\s*(?:मिनट|मिनिटे|நிமிடம்|minutes?))?|\\s+(${numbers}))?`,
    'iu'
  )
  match = clockPattern.exec(source)
  if (!match) return null
  const hour = numberValue(match[1], language)
  const minute = match[2] ? Number(match[2]) : match[3] ? numberValue(match[3], language) : match[4] ? numberValue(match[4], language) : 0
  const hasTimeCue = Boolean(match[2] || match[3] || match[4]) ||
    /(?:बजे|वाजता|மணிக்கு|am|pm|a\.m\.|p\.m\.)/iu.test(source) ||
    Object.keys(DAY_PARTS[language]).some((word) => source.includes(word))
  if (!hasTimeCue) return null
  return to24Hour(hour, minute, dayPart)
}

function removeTimeExpression(source, language) {
  let result = source
  const dayParts = Object.keys(DAY_PARTS[language]).join('|')
  if (dayParts) result = result.replace(new RegExp(`(?:${dayParts})`, 'giu'), ' ')
  const numbers = `\\d{1,2}|${numberAlternation(language)}`
  result = result.replace(new RegExp(`(?:in\\s+)?(?:${numbers})\\s*(?:minutes?|mins?|hours?|hrs?|मिनटों?|घंटों?|मिनिट(?:ांनी|ात|े)?|तास|நிமிடங்களில்|நிமிடத்தில்|நிமிடம்|மணிநேரத்தில்)(?:\\s*(?:में|बाद|मध्ये|नंतर|आत))?`, 'giu'), ' ')
  result = result.replace(/\b(?:am|pm|a\.m\.|p\.m\.|noon|midday|midnight)\b/giu, ' ')
  result = result.replace(new RegExp(`(?:${numbers})\\s*(?::\\s*\\d{1,2}|\\s+(?:बजकर|वाजून|மணி(?:க்கு)?|hour(?:s)?(?:\\s+and)?|बजे|वाजता|மணிக்கு)\\s*(?:${numbers})?(?:\\s*(?:मिनट|मिनिटे|நிமிடம்|minutes?))?|\\s*(?:बजे|वाजता|மணிக்கு))`, 'giu'), ' ')
  result = result.replace(/\d{1,2}(?::\d{1,2})?(?:\s*(?:am|pm|a\.m\.|p\.m\.))?/giu, ' ')
  const timeWords = [
    'बजे', 'वाजता', 'बजकर', 'वाजून', 'मिनट', 'मिनटों', 'मिनिट', 'मिनिटे', 'நிமிடங்களில்', 'நிமிடத்தில்',
    'நிமிடம்', 'மணிக்கு', 'मिनट में', 'मिनिटांनी', 'मिनिटात', 'घंटे', 'घंटों', 'तास', 'சाढ़े', 'साढ़े',
    'साडे', 'सव्वा', 'पौने', 'पावणे', 'அரை', 'கால்', 'குறைவு'
  ]
  for (const word of timeWords) result = result.replace(new RegExp(word, 'giu'), ' ')
  return result
}

function cleanReminderTitle(source, language) {
  let title = removeTimeExpression(source, language)
  title = title
    .replace(/\b(?:remind me to|remind me|set (?:a )?reminder|reminder|alarm|at|in)\b/giu, ' ')
    .replace(/याद दिलाओ|याद दिला|याद दिलाने|रिमाइंडर|अलार्म|लगाओ|लगाना|करो|करना|बजे|पर/giu, ' ')
    .replace(/आठवण करून दे|आठवण|स्मरणपत्र|रिमाइंडर|अलार्म|लावा|लाव|करा|दे|वाजता/giu, ' ')
    .replace(/நினைவூட்டல்|நினைவூட்டு|நினைவூட்ட|அலாரம்|அமை|அமைக்கவும்/giu, ' ')
    .replace(/^[\s,.:;!?।॥-]+|[\s,.:;!?।॥-]+$/gu, '')
    .replace(/\s+(?:का|की|के|को|में|में|चा|ची|चे|चा|मध्ये|चा|ची)$/u, '')
    .replace(/\s+/gu, ' ')
    .trim()
  return title
}

export function parseReminderUtterance(input, selectedLanguage = 'english', now = new Date()) {
  if (typeof input !== 'string' || !input.trim()) return { status: 'not-reminder' }
  const source = foldDigits(input.normalize('NFC')).toLowerCase().replace(/[।॥,!?]+/gu, ' ').replace(/\s+/gu, ' ').trim()
  if (!REMINDER_CREATE_CUE.test(source)) return { status: 'not-reminder' }
  const language = languageKey(selectedLanguage, source)
  const timeOfDay = parseTime(source, language, now)
  const title = cleanReminderTitle(source, language)
  if (!timeOfDay || !title) {
    return {
      status: 'clarify',
      reply: CLARIFICATIONS[language === 'hi' ? 'hindi' : language === 'mr' ? 'marathi' : language === 'ta' ? 'tamil' : 'english']
    }
  }
  return { status: 'complete', action: { id: 'reminder.create', params: { title, time: timeOfDay } } }
}

export function normalizePlannerReminder(params, selectedLanguage = 'english', now = new Date()) {
  const language = languageKey(selectedLanguage)
  const title = typeof params?.title === 'string' ? cleanReminderTitle(params.title, language) : ''
  const timeOfDay = typeof params?.time === 'string' ? parseTime(params.time, language, now) : null
  if (!title || !timeOfDay) {
    return {
      valid: false,
      reply: CLARIFICATIONS[language === 'hi' ? 'hindi' : language === 'mr' ? 'marathi' : language === 'ta' ? 'tamil' : 'english']
    }
  }
  return { valid: true, params: { title, time: timeOfDay } }
}

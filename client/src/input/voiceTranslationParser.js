const LANGUAGE_ALIASES = new Map([
  ['english', ['english', 'इंग्लिश', 'अंग्रेज़ी', 'अंग्रेजी', 'ஆங்கிலம்', 'இங்கிலீஷ்']],
  ['Hindi', ['hindi', 'हिंदी', 'हिन्दी', 'ஹிந்தி']],
  ['Marathi', ['marathi', 'मराठी', 'மராத்தி']],
  ['Tamil', ['tamil', 'तमिल', 'தமிழ்', 'தமிழ் மொழி', 'तमिळ']],
  ['Spanish', ['spanish', 'स्पेनिश', 'ஸ்பானிஷ்']],
  ['French', ['french', 'फ्रेंच', 'பிரெஞ்சு']],
  ['German', ['german', 'जर्मन', 'ஜெர்மன்']],
  ['Italian', ['italian', 'इतालवी', 'இத்தாலியன்']],
  ['Portuguese', ['portuguese', 'पुर्तगाली', 'போர்ச்சுகீஸ்']],
  ['Russian', ['russian', 'रूसी', 'ரஷ்யன்']],
  ['Japanese', ['japanese', 'जापानी', 'ஜப்பானியம்']],
  ['Korean', ['korean', 'कोरियाई', 'கொரியன்']],
  ['Chinese', ['chinese', 'चीनी', 'சீனம்']],
  ['Arabic', ['arabic', 'अरबी', 'அரபு']],
  ['Bengali', ['bengali', 'बंगाली', 'வங்காளம்']],
  ['Telugu', ['telugu', 'तेलुगु', 'தெலுங்கு']],
  ['Gujarati', ['gujarati', 'गुजराती', 'குஜராத்தி']],
  ['Kannada', ['kannada', 'कन्नड़', 'கன்னடம்']],
  ['Malayalam', ['malayalam', 'मलयालम', 'மலையாளம்']],
  ['Punjabi', ['punjabi', 'पंजाबी', 'பஞ்சாபி']],
  ['Urdu', ['urdu', 'उर्दू', 'உருது']],
  ['Turkish', ['turkish', 'तुर्की', 'துருக்கியம்']],
  ['Dutch', ['dutch', 'डच', 'டச்சு']],
  ['Swedish', ['swedish', 'स्वीडिश', 'ஸ்வீடிஷ்']],
  ['Polish', ['polish', 'पोलिश', 'போலிஷ்']]
])

const PREFIXES = [
  /^(?:please\s+)?(?:translate|convert)\s+/iu,
  /^(?:कृपया\s*)?(?:अनुवाद\s*(?:करो|करें|करना)|भाषांतर\s*(?:करा|कर))\s*/iu,
  /^(?:தயவுசெய்து\s*)?(?:மொழிபெயர்|மொழிபெயர்க்கவும்|மொழிபெயர்த்து)\s*/iu
]

function resolveTarget(value) {
  const normalized = value.normalize('NFC').toLocaleLowerCase().trim().replace(/[.,!?।॥]+$/gu, '')
  for (const [canonical, aliases] of LANGUAGE_ALIASES) {
    if (aliases.some((alias) => alias.normalize('NFC').toLocaleLowerCase() === normalized)) return canonical
  }
  return null
}

function stripConnector(value) {
  return value.replace(/(?:\s+(?:to|into|in|as|को|में|मे|मध्ये|मध्ये|मध्ये|க்கு|இல்|ஆக))\s*$/iu, '').trim()
}

export function parseTranslateRequest(input) {
  if (typeof input !== 'string' || !input.trim()) return null
  const source = input.normalize('NFC').replace(/[।॥]+/gu, ' ').replace(/\s+/gu, ' ').trim()
  let remainder = source
  for (const prefix of PREFIXES) {
    if (prefix.test(remainder)) {
      remainder = remainder.replace(prefix, '')
      break
    }
  }

  const candidates = [...LANGUAGE_ALIASES.entries()]
    .flatMap(([target, aliases]) => aliases.map((alias) => ({ target, alias })))
    .sort((left, right) => right.alias.length - left.alias.length)
  for (const { target, alias } of candidates) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    const suffix = new RegExp(`^(.*?)\\s*(?:to|into|in|as|को|में|मे|मध्ये|க்கு|இல்|ஆக)?\\s+${escaped}\\s*[.!?]*$`, 'iu')
    const suffixMatch = remainder.match(suffix)
    if (suffixMatch?.[1]?.trim()) {
      const text = stripConnector(suffixMatch[1])
      if (text) return { text, target }
    }

    const nativeSuffix = new RegExp(
      `^(.+?)\\s+(?:को|का|के|चे|चा|ची|ஐ|ஐயை)?\\s*${escaped}(?:मध्ये|இல்|க்கு|में|मे|ஆக)?\\s+(?:में\\s+)?(?:अनुवाद\\s*(?:करो|करें)|भाषांतर\\s*(?:करा|कर)|மொழிபெயர்|மொழிபெயர்க்கவும்)$`,
      'iu'
    ).exec(source)
    if (nativeSuffix?.[1]?.trim()) {
      return { text: nativeSuffix[1].trim().replace(/[-–]?(?:ஐ|ஐயை)$/u, ''), target }
    }

    const prefix = new RegExp(`^(?:to|into|in|में|मे|मध्ये|க்கு|இல்|ஆக)\\s+${escaped}\\s+(.+)$`, 'iu')
    const prefixMatch = remainder.match(prefix)
    if (prefixMatch?.[1]?.trim()) return { text: prefixMatch[1].trim(), target }

    const nativeTargetFirst = new RegExp(`^${escaped}(?:\\s+में|\\s+मध्ये|\\s+இல்|\\s+ஆக)?\\s+(.+?)\\s*(?:का\\s+)?(?:अनुवाद|भाषांतर)$`, 'iu')
    const nativeMatch = source.match(nativeTargetFirst)
    if (nativeMatch?.[1]?.trim()) return { text: nativeMatch[1].trim(), target }
    const tamilTargetFirst = new RegExp(`^${escaped}(?:இல்|க்கு)?\\s+(.+?)\\s+(?:மொழிபெயர்|மொழிபெயர்க்கவும்)$`, 'iu')
    const tamilMatch = source.match(tamilTargetFirst)
    if (tamilMatch?.[1]?.trim()) return { text: tamilMatch[1].trim(), target }
  }

  const generic = source.match(/^(?:translate|convert)\s+(.+?)\s+(?:to|into|in)\s+(.+)$/iu)
  if (generic) {
    const target = resolveTarget(generic[2])
    if (target) return { text: generic[1].trim(), target }
  }
  return null
}

export { resolveTarget as resolveVoiceTranslationTarget }

import ACTION_REGISTRY from '../../../shared/voice-action-registry.json' with { type: 'json' }

const actionPhrases = Object.fromEntries(
  ACTION_REGISTRY.map(({ id }) => [id, { en: [], hi: [], mr: [], ta: [] }])
)

function add(actionId, params, phrases) {
  for (const language of ['en', 'hi', 'mr', 'ta']) {
    for (const text of phrases[language]) {
      actionPhrases[actionId][language].push({ text, params })
    }
  }
}

const apps = [
  { id: 'FileExplorer', en: 'file explorer', hi: 'फाइल एक्सप्लोरर', mr: 'फाइल एक्सप्लोरर', ta: 'கோப்பு எக்ஸ்ப்ளோரர்', aliases: ['files', 'explorer', 'file manager', 'my files'] },
  { id: 'Terminal', en: 'terminal', hi: 'टर्मिनल', mr: 'टर्मिनल', ta: 'டெர்மினல்', aliases: ['command prompt', 'cmd'] },
  { id: 'Calculator', en: 'calculator', hi: 'कैलकुलेटर', mr: 'कॅल्क्युलेटर', ta: 'கால்குலேட்டர்', aliases: ['calc'] },
  { id: 'Notes', en: 'notes', hi: 'नोटपैड', mr: 'नोट्स', ta: 'நோட்ஸ்', aliases: ['notepad'] },
  { id: 'Browser', en: 'browser', hi: 'ब्राउज़र', mr: 'ब्राउझर', ta: 'பிரவுசர்', aliases: ['internet', 'web browser', 'web', 'chrome'] },
  { id: 'Settings', en: 'settings', hi: 'सेटिंग्स', mr: 'सेटिंग्ज', ta: 'செட்டிங்ஸ்', aliases: ['preferences', 'system settings'] },
  { id: 'Translator', en: 'translator', hi: 'ट्रांसलेटर', mr: 'ट्रान्सलेटर', ta: 'மொழிபெயர்ப்பி', aliases: ['translate'] },
  { id: 'Presentation', en: 'presentation', hi: 'प्रेजेंटेशन', mr: 'प्रेझेंटेशन', ta: 'பிரசண்டேஷன்', aliases: ['presentations', 'slides'] },
  { id: 'Reminders', en: 'reminders', hi: 'रिमाइंडर', mr: 'रिमाइंडर', ta: 'நினைவூட்டல்கள்', aliases: ['my reminders'] },
  { id: 'Emergency', en: 'emergency contacts', hi: 'आपातकालीन संपर्क', mr: 'आपत्कालीन संपर्क', ta: 'அவசர தொடர்புகள்', aliases: ['contacts', 'sos contacts'] },
  { id: 'Vault', en: 'vault', hi: 'वॉल्ट', mr: 'वॉल्ट', ta: 'வால்ட்', aliases: ['secure vault', 'passwords'] },
  { id: 'PdfViewer', en: 'pdf viewer', hi: 'पीडीएफ व्यूअर', mr: 'पीडीएफ व्ह्यूअर', ta: 'பிடிஎஃப் பார்வையாளர்', aliases: ['pdf'] },
  { id: 'ImageViewer', en: 'image viewer', hi: 'इमेज व्यूअर', mr: 'इमेज व्ह्यूअर', ta: 'படக் காட்சியகம்', aliases: ['image'] },
  { id: 'Mail', en: 'mail', hi: 'मेल', mr: 'मेल', ta: 'மெயில்', aliases: ['email'] },
  { id: 'KnownBook', en: 'known book', hi: 'संपर्क पुस्तिका', mr: 'संपर्क वही', ta: 'தொடர்பு புத்தகம்', aliases: ['people'] }
]

for (const app of apps) {
  const params = { app: app.id }
  add('app.open', params, {
    en: [
      `open ${app.en}`,
      `launch ${app.en}`,
      `start ${app.en}`,
      app.en,
      ...(app.aliases || []),
      ...(app.aliases || []).map((alias) => `open ${alias}`),
      ...(app.id === 'Presentation' ? ['show slides', 'show presentations'] : []),
      ...(app.id === 'Reminders' ? ['show reminders'] : [])
    ],
    hi: [`${app.hi} खोलो`, `ओपन ${app.hi}`, `${app.hi} चालू करो`, app.hi],
    mr: [`${app.mr} उघडा`, `ओपन ${app.mr}`, `${app.mr} सुरू करा`, app.mr],
    ta: [`${app.ta} திற`, `ஓபன் ${app.ta}`, `${app.ta} தொடங்கு`, app.ta]
  })
  add('window.close_app', params, {
    en: [`close ${app.en}`, `exit ${app.en}`, `shut ${app.en}`],
    hi: [`${app.hi} बंद करो`, `${app.hi} बंद कर दो`, `${app.hi} को बंद करें`],
    mr: [`${app.mr} बंद करा`, `${app.mr} बंद करा ना`, `${app.mr} बंद करा आता`],
    ta: [`${app.ta} மூடு`, `${app.ta} மூடவும்`, `${app.ta} ஐ மூடு`]
  })
  add('window.switch', params, {
    en: [`switch to ${app.en}`, `focus ${app.en}`, ...(app.id === 'Presentation' || app.id === 'Reminders' ? [] : [`show ${app.en}`])],
    hi: [`${app.hi} पर जाओ`, `${app.hi} पर स्विच करो`, `${app.hi} विंडो पर जाओ`],
    mr: [`${app.mr} वर जा`, `${app.mr} वर स्विच करा`, `${app.mr} विंडोवर जा`],
    ta: [`${app.ta} க்கு செல்`, `${app.ta} க்கு மாறு`, `${app.ta} செயலிக்கு மாறு`]
  })
}

add('window.close_active', {}, {
  en: ['close window', 'close this window', 'close it', 'close this', 'close app'],
  hi: ['विंडो बंद करो', 'इसे बंद कर दो', 'यह विंडो बंद करो', 'इसे बंद करो'],
  mr: ['विंडो बंद करा', 'ही विंडो बंद करा', 'हे बंद करा', 'हे बंद करा आता'],
  ta: ['சாளரத்தை மூடு', 'இந்த சாளரத்தை மூடவும்', 'இதை மூடு', 'இந்த சாளரத்தை மூடு']
})
add('window.close_all', {}, {
  en: ['close all windows', 'close everything', 'shut all windows'],
  hi: ['सभी विंडो बंद करो', 'सारी विंडो बंद कर दो', 'सब कुछ बंद करो'],
  mr: ['सर्व विंडो बंद करा', 'सगळ्या विंडो बंद करा', 'सर्व खिडक्या बंद करा'],
  ta: ['எல்லா சாளரங்களையும் மூடு', 'அனைத்து சாளரங்களையும் மூடவும்', 'எல்லாவற்றையும் மூடு']
})
add('window.minimize', {}, {
  en: ['minimize window', 'minimize this', 'hide window', 'hide this', 'minimize'],
  hi: ['विंडो मिनिमाइज़ करो', 'विंडो छोटी करो', 'इसे छोटा करो', 'विंडो छिपाओ'],
  mr: ['विंडो मिनिमाइझ करा', 'विंडो लहान करा', 'ही विंडो लपवा', 'विंडो लपवा'],
  ta: ['சாளரத்தை சிறிதாக்கு', 'விண்டோவை மினிமைஸ் செய்', 'சாளரத்தை மறை', 'இந்த சாளரத்தை மறை']
})
add('window.maximize', {}, {
  en: ['maximize window', 'maximize this', 'maximize', 'make window full screen'],
  hi: ['विंडो मैक्सिमाइज़ करो', 'विंडो बड़ी करो', 'फुल स्क्रीन करो'],
  mr: ['विंडो मॅक्सिमाइझ करा', 'विंडो मोठी करा', 'फुल स्क्रीन करा'],
  ta: ['சாளரத்தை பெரிதாக்கு', 'விண்டோவை மேக்சிமைஸ் செய்', 'முழுத்திரை செய்']
})
add('window.switch', { direction: 'next' }, {
  en: ['next window', 'switch to next window', 'show next app'],
  hi: ['अगली विंडो दिखाओ', 'अगली विंडो पर जाओ', 'अगला ऐप दिखाओ'],
  mr: ['पुढची विंडो दाखवा', 'पुढच्या विंडोवर जा', 'पुढचे अॅप दाखवा'],
  ta: ['அடுத்த சாளரத்தைக் காட்டு', 'அடுத்த சாளரத்திற்கு மாறு', 'அடுத்த செயலியைக் காட்டு']
})
add('window.switch', { direction: 'previous' }, {
  en: ['previous window', 'switch to previous window', 'show previous app'],
  hi: ['पिछली विंडो दिखाओ', 'पिछली विंडो पर जाओ', 'पिछला ऐप दिखाओ'],
  mr: ['मागची विंडो दाखवा', 'मागच्या विंडोवर जा', 'मागचे अॅप दाखवा'],
  ta: ['முந்தைய சாளரத்தைக் காட்டு', 'முந்தைய சாளரத்திற்கு மாறு', 'முந்தைய செயலியைக் காட்டு']
})
add('window.show_desktop', {}, {
  en: ['show desktop', 'go to desktop', 'show the home screen', 'desktop', 'home', 'go home'],
  hi: ['डेस्कटॉप दिखाओ', 'डेस्कटॉप पर जाओ', 'होम स्क्रीन दिखाओ', 'डेस्कटॉप'],
  mr: ['डेस्कटॉप दाखवा', 'डेस्कटॉपवर जा', 'होम स्क्रीन दाखवा', 'डेस्कटॉप'],
  ta: ['டெஸ்க்டாப்பைக் காட்டு', 'டெஸ்க்டாப்பிற்கு செல்', 'முகப்புத் திரையைக் காட்டு', 'டெஸ்க்டாப்']
})

const valueCommands = {
  'appearance.theme': {
    dark: {
      en: ['set dark theme', 'turn on dark mode', 'use dark mode'],
      hi: ['डार्क थीम सेट करो', 'डार्क मोड चालू करो', 'गहरी थीम लगाओ'],
      mr: ['डार्क थीम लावा', 'डार्क मोड सुरू करा', 'गडद थीम सेट करा'],
      ta: ['டார்க் தீமை அமை', 'டார்க் மோடை இயக்கு', 'இருண்ட தீமை பயன்படுத்து']
    },
    light: {
      en: ['set light theme', 'turn on light mode', 'use light mode'],
      hi: ['लाइट थीम सेट करो', 'लाइट मोड चालू करो', 'हल्की थीम लगाओ'],
      mr: ['लाइट थीम लावा', 'लाइट मोड सुरू करा', 'फिकट थीम सेट करा'],
      ta: ['லைட் தீமை அமை', 'லைட் மோடை இயக்கு', 'வெளிர் தீமை பயன்படுத்து']
    }
  },
  'appearance.font_size': {
    normal: {
      en: ['set normal font size', 'use normal text size', 'reset font size'],
      hi: ['फ़ॉन्ट सामान्य करो', 'सामान्य टेक्स्ट आकार सेट करो', 'फ़ॉन्ट आकार रीसेट करो'],
      mr: ['फॉन्टचा आकार सामान्य करा', 'सामान्य मजकूर आकार ठेवा', 'फॉन्ट आकार रीसेट करा'],
      ta: ['எழுத்து அளவை இயல்பாக அமை', 'சாதாரண உரை அளவை பயன்படுத்து', 'எழுத்து அளவை மீட்டமை']
    },
    large: {
      en: ['set large font size', 'make text larger', 'increase font size'],
      hi: ['फ़ॉन्ट बड़ा करो', 'टेक्स्ट बड़ा करो', 'फ़ॉन्ट आकार बढ़ाओ'],
      mr: ['फॉन्ट मोठा करा', 'मजकूर मोठा करा', 'फॉन्टचा आकार वाढवा'],
      ta: ['எழுத்தை பெரிதாக்கு', 'உரை அளவை பெரிதாக்கு', 'எழுத்து அளவை அதிகரி']
    },
    xl: {
      en: ['set extra large font', 'make text extra large', 'use extra large text'],
      hi: ['फ़ॉन्ट बहुत बड़ा करो', 'टेक्स्ट बहुत बड़ा करो', 'बहुत बड़ा टेक्स्ट सेट करो'],
      mr: ['फॉन्ट खूप मोठा करा', 'मजकूर खूप मोठा करा', 'अतिमोठा मजकूर ठेवा'],
      ta: ['எழுத்தை மிகப் பெரிதாக்கு', 'உரையை மிகப் பெரிதாக்கு', 'மிகப்பெரிய எழுத்தை அமை']
    }
  },
  'appearance.font_weight': {
    normal: {
      en: ['set normal font weight', 'use regular text weight', 'reset font weight'],
      hi: ['फ़ॉन्ट सामान्य मोटाई का करो', 'सामान्य फ़ॉन्ट वज़न सेट करो', 'फ़ॉन्ट वज़न रीसेट करो'],
      mr: ['फॉन्टची जाडी सामान्य करा', 'सामान्य फॉन्ट वजन ठेवा', 'फॉन्ट वजन रीसेट करा'],
      ta: ['எழுத்தின் தடிமனை இயல்பாக அமை', 'சாதாரண எழுத்துத் தடிமனை பயன்படுத்து', 'எழுத்துத் தடிமனை மீட்டமை']
    },
    medium: {
      en: ['set medium font weight', 'use medium text weight', 'make font medium'],
      hi: ['फ़ॉन्ट मध्यम मोटाई का करो', 'मध्यम फ़ॉन्ट वज़न सेट करो', 'फ़ॉन्ट मध्यम करो'],
      mr: ['फॉन्टची जाडी मध्यम करा', 'मध्यम फॉन्ट वजन ठेवा', 'फॉन्ट मध्यम करा'],
      ta: ['எழுத்தை நடுத்தர தடிமனாக்கு', 'நடுத்தர எழுத்துத் தடிமனை அமை', 'எழுத்தை நடுத்தரமாக்கு']
    },
    bold: {
      en: ['set bold font', 'make text bold', 'use bold text'],
      hi: ['फ़ॉन्ट बोल्ड करो', 'टेक्स्ट मोटा करो', 'बोल्ड टेक्स्ट सेट करो'],
      mr: ['फॉन्ट ठळक करा', 'मजकूर ठळक करा', 'बोल्ड टेक्स्ट ठेवा'],
      ta: ['எழுத்தை தடிமனாக்கு', 'உரையை தடிமனாக்கு', 'தடிமனான எழுத்தை அமை']
    }
  },
  'appearance.contrast': {
    normal: {
      en: ['set normal contrast', 'turn off high contrast', 'use regular contrast'],
      hi: ['सामान्य कंट्रास्ट सेट करो', 'हाई कंट्रास्ट बंद करो', 'कंट्रास्ट सामान्य करो'],
      mr: ['सामान्य कॉन्ट्रास्ट ठेवा', 'हाय कॉन्ट्रास्ट बंद करा', 'कॉन्ट्रास्ट सामान्य करा'],
      ta: ['இயல்பான கான்ட்ராஸ்ட் அமை', 'உயர் கான்ட்ராஸ்டை முடக்கு', 'சாதாரண கான்ட்ராஸ்ட் பயன்படுத்து']
    },
    high: {
      en: ['set high contrast', 'turn on high contrast', 'increase contrast'],
      hi: ['हाई कंट्रास्ट सेट करो', 'हाई कंट्रास्ट चालू करो', 'कंट्रास्ट बढ़ाओ'],
      mr: ['हाय कॉन्ट्रास्ट सेट करा', 'हाय कॉन्ट्रास्ट सुरू करा', 'कॉन्ट्रास्ट वाढवा'],
      ta: ['உயர் கான்ட்ராஸ்ட் அமை', 'உயர் கான்ட்ராஸ்டை இயக்கு', 'கான்ட்ராஸ்டை அதிகரி']
    }
  },
  'appearance.cursor_size': {
    normal: {
      en: ['set normal cursor size', 'reset cursor size', 'use a normal cursor'],
      hi: ['कर्सर सामान्य आकार का करो', 'कर्सर आकार रीसेट करो', 'सामान्य कर्सर रखो'],
      mr: ['कर्सरचा आकार सामान्य करा', 'कर्सर आकार रीसेट करा', 'सामान्य कर्सर ठेवा'],
      ta: ['கர்சர் அளவை இயல்பாக அமை', 'கர்சர் அளவை மீட்டமை', 'சாதாரண கர்சரை பயன்படுத்து']
    },
    large: {
      en: ['set large cursor', 'make cursor bigger', 'increase cursor size'],
      hi: ['कर्सर बड़ा करो', 'कर्सर का आकार बढ़ाओ', 'बड़ा कर्सर सेट करो'],
      mr: ['कर्सर मोठा करा', 'कर्सरचा आकार वाढवा', 'मोठा कर्सर ठेवा'],
      ta: ['கர்சரை பெரிதாக்கு', 'கர்சர் அளவை அதிகரி', 'பெரிய கர்சரை அமை']
    }
  }
}

for (const [actionId, values] of Object.entries(valueCommands)) {
  for (const [value, phrases] of Object.entries(values)) add(actionId, { value }, phrases)
}

const profiles = {
  default: ['default', 'डिफ़ॉल्ट', 'डीफॉल्ट', 'இயல்புநிலை'],
  elderly: ['elderly', 'वरिष्ठ', 'ज्येष्ठ', 'முதியோர்'],
  'visually-impaired': ['visually impaired', 'दृष्टिबाधित', 'दृष्टिहीन', 'பார்வை குறைபாடு'],
  'motor-impaired': ['motor impaired', 'गतिशीलता सहायता', 'हालचाल सहाय्य', 'இயக்க குறைபாடு'],
  beginner: ['beginner', 'शुरुआती', 'नवशिक्या', 'தொடக்கநிலை']
}
for (const [profile, [en, hi, mr, ta]] of Object.entries(profiles)) {
  add('accessibility.profile', { profile }, {
    en: [`apply ${en} profile`, `use ${en} accessibility profile`, `set ${en} profile`],
    hi: [`${hi} प्रोफ़ाइल लागू करो`, `${hi} एक्सेसिबिलिटी मोड चालू करो`, `${hi} प्रोफ़ाइल सेट करो`],
    mr: [`${mr} प्रोफाइल लागू करा`, `${mr} अॅक्सेसिबिलिटी मोड सुरू करा`, `${mr} प्रोफाइल सेट करा`],
    ta: [`${ta} சுயவிவரத்தை பயன்படுத்து`, `${ta} அணுகல்தன்மை பயன்முறையை இயக்கு`, `${ta} சுயவிவரத்தை அமை`]
  })
}

const featureLabels = {
  voice: ['voice', 'वॉइस', 'व्हॉइस', 'குரல்'],
  gesture: ['gesture', 'जेस्चर', 'जेश्चर', 'சைகை'],
  eyeTracking: ['eye tracking', 'आई ट्रैकिंग', 'आय ट्रॅकिंग', 'கண் கண்காணிப்பு'],
  signLanguage: ['sign language', 'साइन लैंग्वेज', 'साइन भाषा', 'சைகை மொழி'],
  pathGuidance: ['path guidance', 'पाथ गाइडेंस', 'मार्गदर्शन', 'வழிகாட்டல்'],
  textToSpeech: ['text to speech', 'टेक्स्ट टू स्पीच', 'टेक्स्ट टू स्पीच', 'உரை பேச்சு'],
  visualAlerts: ['visual alerts', 'विज़ुअल अलर्ट', 'व्हिज्युअल अलर्ट', 'காட்சி எச்சரிக்கை'],
  gestureCursor: ['gesture cursor', 'जेस्चर कर्सर', 'जेश्चर कर्सर', 'சைகை கர்சர்'],
  sound: ['sound', 'ध्वनि सुविधा', 'ध्वनी सुविधा', 'ஒலி வசதி']
}
for (const [feature, labels] of Object.entries(featureLabels)) {
  for (const enabled of [true, false]) {
    const state = enabled
      ? [['enable', 'turn on'], ['चालू करो', 'सक्रिय करो'], ['सुरू करा', 'चालू करा'], ['இயக்கு', 'தொடங்கு']]
      : [['disable', 'turn off'], ['बंद करो', 'निष्क्रिय करो'], ['बंद करा', 'थांबवा'], ['முடக்கு', 'நிறுத்து']]
    add('feature.toggle', { feature, enabled }, {
      en: state[0].map((verb) => `${verb} ${labels[0]}`),
      hi: state[1].map((verb) => `${labels[1]} ${verb}`),
      mr: state[2].map((verb) => `${labels[2]} ${verb}`),
      ta: state[3].map((verb) => `${labels[3]} ${verb}`)
    })
  }
}

add('accessibility.zoom', { direction: 'in' }, {
  en: ['zoom in', 'increase screen zoom', 'make the screen bigger', 'make bigger', 'increase size', 'larger text'],
  hi: ['ज़ूम बढ़ाओ', 'स्क्रीन ज़ूम इन करो', 'स्क्रीन बड़ी करो', 'आकार बढ़ाओ'],
  mr: ['झूम वाढवा', 'स्क्रीन झूम इन करा', 'स्क्रीन मोठी करा', 'आकार वाढवा'],
  ta: ['ஜூமை அதிகரி', 'திரையை பெரிதாக்கு', 'திரை ஜூமை உயர்த்து', 'பெரிதாக்கு', 'அளவை அதிகரி']
})
add('accessibility.zoom', { direction: 'out' }, {
  en: ['zoom out', 'decrease screen zoom', 'make the screen smaller', 'make smaller', 'decrease size', 'smaller text'],
  hi: ['ज़ूम कम करो', 'स्क्रीन ज़ूम आउट करो', 'स्क्रीन छोटी करो', 'आकार घटाओ', 'टेक्स्ट छोटा करो'],
  mr: ['झूम कमी करा', 'स्क्रीन झूम आउट करा', 'स्क्रीन लहान करा', 'आकार कमी करा', 'मजकूर लहान करा'],
  ta: ['ஜூமை குறை', 'திரை ஜூமை குறை', 'திரையை சிறிதாக்கு', 'சிறிதாக்கு', 'அளவை குறை', 'எழுத்தை சிறிதாக்கு']
})
add('accessibility.zoom', { direction: 'reset' }, {
  en: ['reset zoom', 'restore normal zoom', 'set default zoom', 'default size', 'normal size', 'normal zoom'],
  hi: ['ज़ूम रीसेट करो', 'सामान्य ज़ूम करो', 'डिफ़ॉल्ट ज़ूम सेट करो', 'सामान्य आकार करो'],
  mr: ['झूम रीसेट करा', 'सामान्य झूम करा', 'डीफॉल्ट झूम ठेवा', 'सामान्य आकार करा'],
  ta: ['ஜூமை மீட்டமை', 'இயல்பான ஜூமை அமை', 'இயல்புநிலை ஜூமை அமை', 'இயல்பான அளவை அமை']
})
add('media.mute', { muted: true }, {
  en: ['mute', 'mute audio', 'turn sound off', 'silence the audio', 'mute sound', 'silence'],
  hi: ['ऑडियो म्यूट करो', 'आवाज़ बंद करो', 'ध्वनि बंद करो', 'आवाज़ म्यूट करो'],
  mr: ['ऑडिओ म्यूट करा', 'आवाज बंद करा', 'ध्वनी बंद करा', 'आवाज म्यूट करा'],
  ta: ['ஒலியை முடக்கு', 'சத்தத்தை நிறுத்து', 'ஆடியோவை மியூட் செய்', 'ஒலியை நிறுத்து']
})
add('media.mute', { muted: false }, {
  en: ['unmute', 'unmute audio', 'turn sound on', 'restore the sound', 'sound on', 'unmute sound'],
  hi: ['ऑडियो अनम्यूट करो', 'आवाज़ चालू करो', 'ध्वनि वापस चालू करो', 'आवाज़ अनम्यूट करो'],
  mr: ['ऑडिओ अनम्यूट करा', 'आवाज सुरू करा', 'ध्वनी पुन्हा सुरू करा', 'आवाज अनम्यूट करा'],
  ta: ['ஒலியை இயக்கு', 'சத்தத்தை மீண்டும் தொடங்கு', 'ஆடியோவை அன்மியூட் செய்', 'ஒலியை மீண்டும் இயக்கு']
})
add('media.volume', { direction: 'up' }, {
  en: ['increase volume', 'turn volume up', 'make audio louder'],
  hi: ['वॉल्यूम बढ़ाओ', 'आवाज़ तेज़ करो', 'ध्वनि बढ़ा दो'],
  mr: ['व्हॉल्यूम वाढवा', 'आवाज मोठा करा', 'ध्वनी वाढवा'],
  ta: ['ஒலியளவை அதிகரி', 'சத்தத்தை உயர்த்து', 'வால்யூமை அதிகப்படுத்து']
})
add('media.volume', { direction: 'down' }, {
  en: ['decrease volume', 'turn volume down', 'make audio quieter'],
  hi: ['वॉल्यूम कम करो', 'आवाज़ धीमी करो', 'ध्वनि घटाओ'],
  mr: ['व्हॉल्यूम कमी करा', 'आवाज कमी करा', 'ध्वनी कमी करा'],
  ta: ['ஒலியளவை குறை', 'சத்தத்தை குறை', 'வால்யூமை குறைத்திடு']
})
add('media.volume', { level: 0.5 }, {
  en: ['set volume to fifty percent', 'set audio volume to half', 'make volume fifty percent'],
  hi: ['वॉल्यूम पचास प्रतिशत करो', 'आवाज़ आधी करो', 'वॉल्यूम पचास पर सेट करो'],
  mr: ['व्हॉल्यूम पन्नास टक्के करा', 'आवाज अर्धा करा', 'व्हॉल्यूम पन्नासवर ठेवा'],
  ta: ['ஒலியளவை ஐம்பது சதவீதமாக்கு', 'ஒலியை பாதியாக்கு', 'வால்யூமை ஐம்பது சதவீதமாக அமை']
})
add('appearance.wallpaper', { value: 'default' }, {
  en: ['set default wallpaper', 'reset wallpaper', 'use the default wallpaper'],
  hi: ['डिफ़ॉल्ट वॉलपेपर सेट करो', 'वॉलपेपर रीसेट करो', 'पहला वॉलपेपर लगाओ'],
  mr: ['डीफॉल्ट वॉलपेपर ठेवा', 'वॉलपेपर रीसेट करा', 'मूळ वॉलपेपर लावा'],
  ta: ['இயல்புநிலை வால்பேப்பரை அமை', 'வால்பேப்பரை மீட்டமை', 'முதன்மை வால்பேப்பரை பயன்படுத்து']
})
const voiceLanguages = [
  { value: 'english', en: 'English', hi: 'अंग्रेज़ी', mr: 'इंग्रजी', ta: 'ஆங்கிலம்' },
  { value: 'hindi', en: 'Hindi', hi: 'हिंदी', mr: 'हिंदी', ta: 'இந்தி' },
  { value: 'marathi', en: 'Marathi', hi: 'मराठी', mr: 'मराठी', ta: 'மராத்தி' },
  { value: 'tamil', en: 'Tamil', hi: 'तमिल', mr: 'तमिळ', ta: 'தமிழ்' }
]
for (const language of voiceLanguages) {
  add('voice.language', { language: language.value }, {
    en: [`set voice language to ${language.en}`, `switch voice to ${language.en}`, `use ${language.en} voice commands`],
    hi: [`वॉइस भाषा ${language.hi} करो`, `${language.hi} वॉइस चुनो`, `${language.hi} में बोलो`],
    mr: [`व्हॉइस भाषा ${language.mr} करा`, `${language.mr} व्हॉइस निवडा`, `${language.mr} मध्ये बोला`],
    ta: [`குரல் மொழியை ${language.ta} ஆக அமை`, `${language.ta} குரலை தேர்வு செய்`, `${language.ta} மொழியில் பேசு`]
  })
}

for (let phase = 0; phase <= 5; phase += 1) {
  add('accessibility.support_phase', { phase }, {
    en: [`set support phase ${phase}`, `change cognitive support to phase ${phase}`, `use support level ${phase}`],
    hi: [`सहायता स्तर ${phase} सेट करो`, `सपोर्ट चरण ${phase} करो`, `सहायता चरण ${phase} पर रखो`],
    mr: [`सहाय्य स्तर ${phase} ठेवा`, `सपोर्ट टप्पा ${phase} करा`, `मदत स्तर ${phase} करा`],
    ta: [`உதவி நிலை ${phase} ஆக அமை`, `ஆதரவு கட்டத்தை ${phase} ஆக மாற்று`, `உதவி நிலை ${phase} பயன்படுத்து`]
  })
}

add('reminder.create', { title: 'water', time: '9 am' }, {
  en: ['remind me to drink water at 9 am', 'create a water reminder for 9 am', 'set reminder water at 9 am'],
  hi: ['मुझे सुबह 9 बजे पानी पीने की याद दिलाओ', 'सुबह 9 बजे पानी का रिमाइंडर बनाओ', 'पानी पीने का रिमाइंडर सुबह 9 बजे लगाओ'],
  mr: ['मला सकाळी 9 वाजता पाणी पिण्याची आठवण करून द्या', 'सकाळी 9 वाजता पाण्याचा रिमाइंडर लावा', 'पाणी पिण्याची आठवण सकाळी 9 वाजता करा'],
  ta: ['காலை 9 மணிக்கு தண்ணீர் குடிக்க நினைவூட்டு', 'காலை 9 மணிக்கு தண்ணீர் நினைவூட்டலை அமை', 'தண்ணீர் குடிக்க காலை 9 மணிக்கு நினைவூட்டல் செய்']
})
add('reminder.list', {}, {
  en: ['list my reminders', 'show all reminders', 'what reminders do I have'],
  hi: ['मेरे रिमाइंडर दिखाओ', 'सभी रिमाइंडर बताओ', 'मेरी याद दिलाने वाली सूचनाएँ दिखाओ'],
  mr: ['माझे रिमाइंडर दाखवा', 'सर्व रिमाइंडर सांगा', 'माझ्या आठवणी दाखवा'],
  ta: ['என் நினைவூட்டல்களை காட்டு', 'எல்லா நினைவூட்டல்களையும் பட்டியலிடு', 'என்ன நினைவூட்டல்கள் உள்ளன']
})
add('reminder.delete', { match: 'water' }, {
  en: ['delete the water reminder', 'remove reminder for water', 'cancel my water reminder'],
  hi: ['पानी का रिमाइंडर हटाओ', 'पानी वाला रिमाइंडर मिटा दो', 'पानी की याद दिलाने वाली सूचना रद्द करो'],
  mr: ['पाण्याचा रिमाइंडर हटवा', 'पाणी रिमाइंडर काढून टाका', 'पाण्याची आठवण रद्द करा'],
  ta: ['தண்ணீர் நினைவூட்டலை நீக்கு', 'தண்ணீர் நினைவூட்டலை அகற்று', 'தண்ணீர் நினைவூட்டலை ரத்து செய்']
})

for (const [command, variants] of Object.entries({
  next: {
    en: ['next slide', 'go to next slide', 'advance the slide'],
    hi: ['अगली स्लाइड दिखाओ', 'अगली स्लाइड पर जाओ', 'स्लाइड आगे बढ़ाओ'],
    mr: ['पुढची स्लाइड दाखवा', 'पुढच्या स्लाइडवर जा', 'स्लाइड पुढे करा'],
    ta: ['அடுத்த ஸ்லைடை காட்டு', 'அடுத்த ஸ்லைடிற்கு செல்', 'ஸ்லைடை முன்னேற்று']
  },
  previous: {
    en: ['previous slide', 'go to previous slide', 'go back one slide'],
    hi: ['पिछली स्लाइड दिखाओ', 'पिछली स्लाइड पर जाओ', 'एक स्लाइड पीछे जाओ'],
    mr: ['मागची स्लाइड दाखवा', 'मागच्या स्लाइडवर जा', 'एक स्लाइड मागे जा'],
    ta: ['முந்தைய ஸ்லைடை காட்டு', 'முந்தைய ஸ்லைடிற்கு செல்', 'ஒரு ஸ்லைடு பின்னால் செல்']
  },
  read: {
    en: ['read this slide', 'read the slide aloud', 'speak the current slide'],
    hi: ['यह स्लाइड पढ़ो', 'स्लाइड पढ़कर सुनाओ', 'मौजूदा स्लाइड बोलकर सुनाओ'],
    mr: ['ही स्लाइड वाचा', 'स्लाइड वाचून दाखवा', 'सध्याची स्लाइड बोलून दाखवा'],
    ta: ['இந்த ஸ்லைடை படி', 'ஸ்லைடை சத்தமாக வாசி', 'தற்போதைய ஸ்லைடை வாசித்து சொல்']
  },
  toggle: {
    en: ['toggle presentation playback', 'pause presentation', 'play presentation', 'auto play', 'autoplay'],
    hi: ['प्रेजेंटेशन पॉज़ करो', 'प्रेजेंटेशन चलाओ', 'स्लाइड शो रोककर चलाओ'],
    mr: ['प्रेझेंटेशन थांबवा', 'प्रेझेंटेशन प्ले करा', 'स्लाइड शो थांबवून सुरू करा'],
    ta: ['விளக்கக்காட்சியை இடைநிறுத்து', 'விளக்கக்காட்சியை இயக்கு', 'ஸ்லைடு காட்சியை நிறுத்தி தொடங்கு']
  },
  close: {
    en: ['stop presentation', 'exit slide show', 'end slide show'],
    hi: ['स्लाइड शो रोक दो', 'प्रेजेंटेशन से बाहर निकलो', 'स्लाइड शो समाप्त करो'],
    mr: ['स्लाइड शो थांबवा', 'प्रेझेंटेशनमधून बाहेर पडा', 'स्लाइड शोमधून बाहेर पडा'],
    ta: ['விளக்கக்காட்சியை நிறுத்து', 'ஸ்லைடு காட்சியை மூடு', 'விளக்கக்காட்சியிலிருந்து வெளியேறு']
  }
})) add('presentation.control', { command }, variants)

add('file.search', { query: 'report', path: '/' }, {
  en: ['search files for report', 'find report in my files', 'look for report in files'],
  hi: ['फाइलों में रिपोर्ट खोजो', 'मेरी फाइलों में रिपोर्ट ढूँढो', 'रिपोर्ट फाइल खोजो'],
  mr: ['फाइलमध्ये रिपोर्ट शोधा', 'माझ्या फाइलमध्ये रिपोर्ट शोधा', 'रिपोर्ट फाइल शोधा'],
  ta: ['கோப்புகளில் அறிக்கையை தேடு', 'என் கோப்புகளில் அறிக்கையை கண்டுபிடி', 'அறிக்கை கோப்பை தேடு']
})
add('file.create', { name: 'notes.txt', type: 'file', path: '/' }, {
  en: ['create file notes.txt', 'make a file called notes.txt', 'create notes.txt in files'],
  hi: ['notes.txt नाम की फाइल बनाओ', 'notes.txt फाइल तैयार करो', 'नई notes.txt फाइल बनाओ'],
  mr: ['notes.txt नावाची फाइल तयार करा', 'notes.txt फाइल बनवा', 'नवीन notes.txt फाइल करा'],
  ta: ['notes.txt என்ற கோப்பை உருவாக்கு', 'notes.txt கோப்பை செய்', 'புதிய notes.txt கோப்பை உருவாக்கு']
})
add('emergency.sos', {}, {
  en: ['start sos emergency countdown', 'trigger emergency sos', 'start emergency help'],
  hi: ['एसओएस आपातकाल शुरू करो', 'इमरजेंसी मदद शुरू करो', 'आपातकालीन सहायता चालू करो'],
  mr: ['एसओएस आपत्काल सुरू करा', 'आपत्कालीन मदत सुरू करा', 'आपत्कालीन सहाय्य चालू करा'],
  ta: ['அவசர எஸ்ஓஎஸ் தொடங்கு', 'அவசர உதவியை தொடங்கு', 'எஸ்ஓஎஸ் அவசரநிலையை தொடங்கு']
})
add('web.open', { url: 'https://google.com' }, {
  en: ['open website google.com', 'go to google.com', 'open google website'],
  hi: ['google.com वेबसाइट खोलो', 'गूगल वेबसाइट पर जाओ', 'गूगल साइट खोल दो'],
  mr: ['google.com वेबसाइट उघडा', 'गूगल वेबसाइटवर जा', 'गूगल साइट सुरू करा'],
  ta: ['google.com இணையதளத்தை திற', 'கூகுள் இணையதளத்திற்கு செல்', 'கூகுள் தளத்தை திற']
})
const websites = [
  { key: 'youtube', url: 'https://www.youtube.com', hi: 'यूट्यूब', mr: 'यूट्यूब', ta: 'யூடியூப்' },
  { key: 'yt', url: 'https://www.youtube.com', hi: 'यूट्यूब', mr: 'यूट्यूब', ta: 'யூடியூப்' },
  { key: 'google', url: 'https://www.google.com', hi: 'गूगल', mr: 'गूगल', ta: 'கூகுள்' },
  { key: 'gmail', url: 'https://mail.google.com', hi: 'जीमेल', mr: 'जीमेल', ta: 'ஜிமெயில்' },
  { key: 'github', url: 'https://github.com', hi: 'गिटहब', mr: 'गिटहब', ta: 'கிட்ஹப்' },
  { key: 'reddit', url: 'https://www.reddit.com', hi: 'रेडिट', mr: 'रेडिट', ta: 'ரெடிட்' },
  { key: 'spotify', url: 'https://open.spotify.com', hi: 'स्पॉटिफाई', mr: 'स्पॉटिफाय', ta: 'ஸ்பாட்டிஃபை' },
  { key: 'netflix', url: 'https://www.netflix.com', hi: 'नेटफ्लिक्स', mr: 'नेटफ्लिक्स', ta: 'நெட்ஃப்ளிக்ஸ்' },
  { key: 'linkedin', url: 'https://www.linkedin.com', hi: 'लिंक्डइन', mr: 'लिंक्डइन', ta: 'லிங்க்ட்இன்' }
]
for (const website of websites) {
  add('web.open', { url: website.url }, {
    en: [`open ${website.key}`, `visit ${website.key}`, `go to ${website.key}`],
    hi: [`${website.hi} खोलो`, `${website.hi} वेबसाइट खोलो`, `${website.hi} पर जाओ`],
    mr: [`${website.mr} उघडा`, `${website.mr} वेबसाइट उघडा`, `${website.mr} वर जा`],
    ta: [`${website.ta} திற`, `${website.ta} இணையதளத்தை திற`, `${website.ta} க்கு செல்`]
  })
}
add('web.search', { query: 'weather today' }, {
  en: ['search the web for weather today', 'look up weather today online', 'google weather today'],
  hi: ['आज का मौसम वेब पर खोजो', 'आज का मौसम ऑनलाइन ढूँढो', 'गूगल पर आज का मौसम खोजो'],
  mr: ['आजचे हवामान वेबवर शोधा', 'आजचे हवामान ऑनलाइन शोधा', 'गूगलवर आजचे हवामान शोधा'],
  ta: ['இன்றைய வானிலையை இணையத்தில் தேடு', 'இன்றைய வானிலையை ஆன்லைனில் தேடு', 'கூகுளில் இன்றைய வானிலையை தேடு']
})
add('web.youtube', { query: 'music' }, {
  en: ['search youtube for music', 'find music videos on youtube', 'play music on youtube'],
  hi: ['यूट्यूब पर संगीत खोजो', 'यूट्यूब पर गाने ढूँढो', 'यूट्यूब पर संगीत चलाओ'],
  mr: ['यूट्यूबवर संगीत शोधा', 'यूट्यूबवर गाणी शोधा', 'यूट्यूबवर संगीत चालवा'],
  ta: ['யூடியூப்பில் இசையை தேடு', 'யூடியூப்பில் பாடல்களை கண்டுபிடி', 'யூடியூப்பில் இசையை இயக்கு']
})
add('help.tour', {}, {
  en: ['open welcome tour', 'start the help tour', 'show me the welcome tour'],
  hi: ['वेलकम टूर खोलो', 'मदद का टूर शुरू करो', 'परिचय यात्रा दिखाओ'],
  mr: ['वेलकम टूर उघडा', 'मदत टूर सुरू करा', 'स्वागत मार्गदर्शन दाखवा'],
  ta: ['வரவேற்பு சுற்றுப்பயணத்தை திற', 'உதவி சுற்றுப்பயணத்தை தொடங்கு', 'வரவேற்பு வழிகாட்டியை காட்டு']
})
add('help.list', {}, {
  en: ['list voice commands', 'what voice commands are available', 'tell me what you can do'],
  hi: ['वॉइस कमांड बताओ', 'आवाज़ से क्या कर सकते हैं', 'सभी वॉइस कमांड दिखाओ'],
  mr: ['व्हॉइस कमांड सांगा', 'आवाज वापरून काय करू शकतो', 'सर्व व्हॉइस कमांड दाखवा'],
  ta: ['குரல் கட்டளைகளை பட்டியலிடு', 'என்ன குரல் கட்டளைகள் உள்ளன', 'நீங்கள் என்ன செய்ய முடியும் என்று சொல்']
})
add('system.time', {}, {
  en: ['what time is it', 'tell me the current time', 'say the time', 'time', 'current time', 'tell me the time', 'what is the time'],
  hi: ['अभी कितने बजे हैं', 'मुझे समय बताओ', 'वर्तमान समय बताओ'],
  mr: ['आत्ता किती वाजले', 'मला वेळ सांगा', 'सध्याची वेळ सांगा'],
  ta: ['இப்போது மணி என்ன', 'நேரத்தை சொல்லு', 'தற்போதைய நேரத்தை கூறு']
})
add('system.date', {}, {
  en: ['what is today date', 'tell me the date today', 'what day is today'],
  hi: ['आज की तारीख क्या है', 'मुझे आज की तारीख बताओ', 'आज कौन सा दिन है'],
  mr: ['आजची तारीख काय आहे', 'मला आजची तारीख सांगा', 'आज कोणता वार आहे'],
  ta: ['இன்றைய தேதி என்ன', 'இன்றைய தேதியை சொல்லு', 'இன்று என்ன கிழமை']
})
add('system.battery', {}, {
  en: ['what is my battery level', 'tell me battery status', 'check the battery', 'battery', 'battery status', 'battery level', 'how much battery'],
  hi: ['बैटरी कितनी है', 'बैटरी की स्थिति बताओ', 'बैटरी चेक करो'],
  mr: ['बॅटरी किती आहे', 'बॅटरीची स्थिती सांगा', 'बॅटरी तपासा'],
  ta: ['பேட்டரி அளவு என்ன', 'பேட்டரி நிலையை சொல்லு', 'பேட்டரியை சரிபார்']
})
add('system.refresh', {}, {
  en: ['refresh the page', 'reload this page', 'restart the page', 'refresh', 'reload', 'restart'],
  hi: ['पेज रीफ्रेश करो', 'इस पेज को फिर से लोड करो', 'पेज दोबारा शुरू करो'],
  mr: ['पेज रिफ्रेश करा', 'हे पेज पुन्हा लोड करा', 'पेज पुन्हा सुरू करा'],
  ta: ['பக்கத்தை புதுப்பி', 'இந்த பக்கத்தை மீண்டும் ஏற்று', 'பக்கத்தை மறுதொடக்கம் செய்']
})
add('system.scroll', { direction: 'down' }, {
  en: ['scroll down', 'move the page down', 'go down the page', 'go down', 'page down'],
  hi: ['नीचे स्क्रॉल करो', 'पेज नीचे ले जाओ', 'नीचे जाओ', 'पेज डाउन'],
  mr: ['खाली स्क्रोल करा', 'पेज खाली न्या', 'खाली जा', 'पेज डाउन'],
  ta: ['கீழே ஸ்க்ரோல் செய்', 'பக்கத்தை கீழே நகர்த்து', 'கீழே செல்', 'பக்கம் கீழே']
})
add('system.scroll', { direction: 'up' }, {
  en: ['scroll up', 'move the page up', 'go up the page', 'go up', 'page up'],
  hi: ['ऊपर स्क्रॉल करो', 'पेज ऊपर ले जाओ', 'ऊपर जाओ', 'पेज अप'],
  mr: ['वर स्क्रोल करा', 'पेज वर न्या', 'वर जा', 'पेज अप'],
  ta: ['மேலே ஸ்க்ரோல் செய்', 'பக்கத்தை மேலே நகர்த்து', 'மேலே செல்', 'பக்கம் மேலே']
})
add('translator.open', { text: 'hello', target: 'Tamil' }, {
  en: ['translate hello to Tamil', 'translate the word hello into Tamil', 'convert hello to Tamil'],
  hi: ['hello का तमिल में अनुवाद करो', 'hello को तमिल में बदलो', 'hello तमिल में कहो'],
  mr: ['hello चे तमिळमध्ये भाषांतर करा', 'hello तमिळमध्ये बदला', 'hello तमिळमध्ये सांगा'],
  ta: ['hello என்பதை தமிழில் மொழிபெயர்', 'hello ஐ தமிழுக்கு மாற்று', 'hello தமிழில் சொல்லு']
})
add('file.open', { path: '/report.txt' }, {
  en: ['open file report.txt', 'open report.txt in files', 'open the file report.txt'],
  hi: ['report.txt फाइल खोलो', 'फाइलों में report.txt खोलो', 'report.txt वाली फाइल खोलो'],
  mr: ['report.txt फाइल उघडा', 'फाइलमध्ये report.txt उघडा', 'report.txt ही फाइल उघडा'],
  ta: ['report.txt கோப்பை திற', 'கோப்புகளில் report.txt திற', 'report.txt என்ற கோப்பை திற']
})
add('file.rename', { oldPath: '/report.txt', newName: 'summary.txt' }, {
  en: ['rename report.txt to summary.txt', 'rename the file report.txt as summary.txt', 'change report.txt name to summary.txt'],
  hi: ['report.txt का नाम summary.txt करो', 'report.txt फाइल का नाम summary.txt रखो', 'report.txt को summary.txt नाम दो'],
  mr: ['report.txt चे नाव summary.txt करा', 'report.txt फाइलचे नाव summary.txt ठेवा', 'report.txt ला summary.txt नाव द्या'],
  ta: ['report.txt பெயரை summary.txt என மாற்று', 'report.txt கோப்பை summary.txt என்று மறுபெயரிடு', 'report.txt இன் பெயரை summary.txt ஆக மாற்று']
})
add('file.move', { sourcePath: '/report.txt', destPath: '/archive/report.txt' }, {
  en: ['move report.txt to archive', 'move the file report.txt into archive', 'move report.txt to archive/report.txt'],
  hi: ['report.txt को archive में ले जाओ', 'report.txt फाइल archive में ले जाओ', 'report.txt को archive/report.txt में ले जाओ'],
  mr: ['report.txt archive मध्ये हलवा', 'report.txt फाइल archive मध्ये न्या', 'report.txt ला archive/report.txt मध्ये हलवा'],
  ta: ['report.txt கோப்பை archive க்கு நகர்த்து', 'report.txt ஐ archive கோப்புறைக்கு நகர்த்து', 'report.txt ஐ archive/report.txt க்கு நகர்த்து']
})
add('file.copy', { sourcePath: '/report.txt', destPath: '/archive/report.txt' }, {
  en: ['copy report.txt to archive', 'copy the file report.txt into archive', 'make a copy of report.txt in archive'],
  hi: ['report.txt की कॉपी archive में बनाओ', 'report.txt फाइल को archive में कॉपी करो', 'report.txt की नकल archive में रखो'],
  mr: ['report.txt ची प्रत archive मध्ये करा', 'report.txt फाइल archive मध्ये कॉपी करा', 'report.txt ची कॉपी archive मध्ये ठेवा'],
  ta: ['report.txt ஐ archive இல் நகலெடு', 'report.txt கோப்பை archive க்கு நகலெடு', 'archive இல் report.txt நகலை உருவாக்கு']
})
add('file.delete', { path: '/report.txt' }, {
  en: ['delete file report.txt', 'move report.txt to trash', 'delete report.txt from files'],
  hi: ['report.txt फाइल हटाओ', 'report.txt को कूड़ेदान में डालो', 'फाइलों से report.txt मिटाओ'],
  mr: ['report.txt फाइल हटवा', 'report.txt कचरापेटीत टाका', 'फाइलमधून report.txt काढून टाका'],
  ta: ['report.txt கோப்பை நீக்கு', 'report.txt ஐ குப்பைக்கு நகர்த்து', 'கோப்புகளில் இருந்து report.txt ஐ நீக்கு']
})
add('assistant.greeting', { kind: 'hello' }, {
  en: ['hello', 'hi', 'hey'],
  hi: ['नमस्ते', 'नमस्कार', 'हैलो'],
  mr: ['नमस्कार', 'हॅलो', 'नमस्ते'],
  ta: ['வணக்கம்', 'ஹலோ', 'வாழ்த்துகள்']
})
add('assistant.greeting', { kind: 'thanks' }, {
  en: ['thank you', 'thanks', 'good job'],
  hi: ['धन्यवाद', 'शुक्रिया', 'बहुत अच्छा'],
  mr: ['धन्यवाद', 'आभार', 'छान काम'],
  ta: ['நன்றி', 'மிக்க நன்றி', 'நன்றாக செய்தீர்கள்']
})

export const VOICE_ACTION_PHRASES = actionPhrases

export const VOICE_ACTION_PHRASE_COUNTS = Object.fromEntries(
  Object.entries(actionPhrases).map(([id, languages]) => [
    id,
    Object.fromEntries(Object.entries(languages).map(([language, phrases]) => [language, phrases.length]))
  ])
)

export const VOICE_ACTION_APP_LABELS = apps

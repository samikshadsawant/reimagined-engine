export const APP_ALIASES = [
  { phrase: 'file explorer', canonical: 'file explorer' },
  { phrase: 'calculator', canonical: 'calculator' },
  { phrase: 'कैलकुलेटर', canonical: 'calculator' },
  { phrase: 'calc', canonical: 'calculator' },
  { phrase: 'notepad', canonical: 'notepad' },
  { phrase: 'नोटपैड', canonical: 'notepad' },
  { phrase: 'notes', canonical: 'notes' },
  { phrase: 'terminal', canonical: 'terminal' },
  { phrase: 'browser', canonical: 'browser' },
  { phrase: 'settings', canonical: 'settings' },
  { phrase: 'reminders', canonical: 'reminders' }
]

export const FILLER_PHRASES = [
  'please',
  'कृपया',
  'ज़रा',
  'जरा',
  'જરા',
  'arey',
  'अरे'
]

export const OPEN_VERBS = [
  'open',
  'kholo',
  'khol do',
  'kholna',
  'खोलो',
  'खोल दो',
  'खोलना'
]

export const CLOSE_VERBS = [
  'close',
  'band karo',
  'band kar do',
  'band kardo',
  'बंद करो',
  'बंद कर दो'
]

export const PHRASE_REPLACEMENTS = [
  {
    phrases: ['yaad dilao', 'yaad dila do', 'yaad dilana', 'याद दिलाओ', 'याद दिला दो', 'याद दिलाना'],
    replacement: 'remind me to'
  },
  {
    phrases: ['volume badhao', 'volume badha do', 'आवाज़ बढ़ाओ', 'आवाज बढ़ाओ', 'आवाज़ बढ़ा दो'],
    replacement: 'increase volume'
  },
  {
    phrases: ['आवाज़ बंद करो', 'आवाज बंद करो', 'audio band karo'],
    replacement: 'mute audio'
  }
]

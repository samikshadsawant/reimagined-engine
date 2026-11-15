const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true })

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not configured in server/.env.')
  process.exit(1)
}

const express = require('express')
const agentRoutes = require('../routes/agent')
const { validateVoicePlan } = require('../lib/voicePlannerValidation')

const samples = [
  ['english', 'Remind me to take medicine at 5:25 PM.'],
  ['english', 'Turn on dark mode.'],
  ['english', 'Please help me organize my day.'],
  ['english', 'What is the difference between weather and climate?'],
  ['hindi', 'शाम ५:२५ बजे दवा लेने का रिमाइंडर लगाओ।'],
  ['hindi', 'डार्क मोड चालू करो।'],
  ['hindi', 'कृपया मेरा दिन व्यवस्थित करने में मदद करो।'],
  ['hindi', 'मौसम और जलवायु में क्या अंतर है?'],
  ['marathi', 'संध्याकाळी ५:२५ वाजता औषध घेण्याची आठवण करून दे।'],
  ['marathi', 'डार्क मोड सुरू करा।'],
  ['marathi', 'कृपया माझा दिवस व्यवस्थित करण्यात मदत करा।'],
  ['marathi', 'हवामान आणि जलवायू यात काय फरक आहे?'],
  ['tamil', 'மாலை ௫:௨௫ மணிக்கு மருந்து நினைவூட்டல் அமை.'],
  ['tamil', 'டார்க் தீமை இயக்கு.'],
  ['tamil', 'என் நாளை ஒழுங்குபடுத்த உதவுங்கள்.'],
  ['tamil', 'வானிலைக்கும் காலநிலைக்கும் என்ன வித்தியாசம்?']
]

const app = express()
app.use(express.json())
app.use('/api/agent', agentRoutes)

const server = app.listen(0, '127.0.0.1', async () => {
  const { port } = server.address()
  let failures = 0
  try {
    for (let index = 0; index < samples.length; index += 1) {
      if (index === 12) await new Promise((resolve) => setTimeout(resolve, 60_100))
      const [language, message] = samples[index]
      let output
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/agent/voice-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, language, sessionHistory: [] })
        })
        const plan = await response.json()
        const validation = response.ok ? validateVoicePlan(plan) : { valid: false }
        if (!validation.valid) failures += 1
        output = {
          utterance: message,
          action: plan.action ?? null,
          params: plan.params ?? {},
          reply: plan.reply || plan.error || '',
          registryAccepted: validation.valid
        }
      } catch (error) {
        failures += 1
        output = {
          utterance: message,
          action: null,
          params: {},
          reply: error.message,
          registryAccepted: false
        }
      }
      console.log(JSON.stringify(output))
    }
  } finally {
    server.close(() => process.exitCode = failures ? 1 : 0)
  }
})

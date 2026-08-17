/**
 * Profile Routes
 * GET/POST /api/profile — Accessibility profile management
 *
 * FIX H2: Profile now persisted to UserProfile DB via Prisma (upsert by userName).
 * FIX H3: requireAuth middleware applied — routes require a valid session.
 */

const express = require('express')
const router  = express.Router()
const prisma  = require('../lib/prisma')                    // FIX H2 + M1
const { requireAuth } = require('../middleware/auth')       // FIX H3

// Profile presets
const PRESETS = {
  default: {
    fontSize: 'normal', contrast: 'normal', cursorSize: 'normal',
    theme: 'dark', gestureEnabled: false, voiceEnabled: false,
    eyeTrackingEnabled: false, animationsReduced: false,
    simplifiedUI: false, tooltipsEnabled: false,
    screenReaderHints: false, highContrast: false,
    largeTargets: false, dwellClick: false,
    keyboardOnly: false, stickyKeys: false,
    onboardingEnabled: false, contextualHelp: false
  },
  elderly: {
    fontSize: 'xl', contrast: 'high', cursorSize: 'large',
    theme: 'dark', gestureEnabled: false, voiceEnabled: true,
    eyeTrackingEnabled: false, animationsReduced: true,
    simplifiedUI: true, tooltipsEnabled: true,
    screenReaderHints: false, highContrast: false,
    largeTargets: true, dwellClick: false,
    keyboardOnly: false, stickyKeys: false,
    onboardingEnabled: false, contextualHelp: true
  },
  'visually-impaired': {
    fontSize: 'xl', contrast: 'high', cursorSize: 'large',
    theme: 'dark', gestureEnabled: false, voiceEnabled: true,
    eyeTrackingEnabled: false, animationsReduced: true,
    simplifiedUI: false, tooltipsEnabled: true,
    screenReaderHints: true, highContrast: true,
    largeTargets: true, dwellClick: true,
    keyboardOnly: false, stickyKeys: false,
    onboardingEnabled: false, contextualHelp: true
  },
  'motor-impaired': {
    fontSize: 'large', contrast: 'normal', cursorSize: 'large',
    theme: 'dark', gestureEnabled: true, voiceEnabled: true,
    eyeTrackingEnabled: false, animationsReduced: false,
    simplifiedUI: false, tooltipsEnabled: true,
    screenReaderHints: false, highContrast: false,
    largeTargets: true, dwellClick: true,
    keyboardOnly: false, stickyKeys: true,
    onboardingEnabled: false, contextualHelp: true
  },
  beginner: {
    fontSize: 'normal', contrast: 'normal', cursorSize: 'normal',
    theme: 'dark', gestureEnabled: false, voiceEnabled: true,
    eyeTrackingEnabled: false, animationsReduced: false,
    simplifiedUI: true, tooltipsEnabled: true,
    screenReaderHints: false, highContrast: false,
    largeTargets: false, dwellClick: false,
    keyboardOnly: false, stickyKeys: false,
    onboardingEnabled: true, contextualHelp: true
  }
}

// FIX H3: all profile routes require authentication
router.use(requireAuth)

// GET /api/profile — return profile from DB, fall back to preset
router.get('/', async (req, res) => {
  try {
    const userName = req.session.userName
    const dbRecord = await prisma.userProfile.findUnique({ where: { userName } })

    if (dbRecord) {
      // Map DB fields to profile shape
      const profile = {
        profileName:    dbRecord.profileName,
        fontSize:       dbRecord.fontSize,
        contrast:       dbRecord.contrast,
        cursorSize:     dbRecord.cursorSize,
        theme:          dbRecord.theme,
        gestureEnabled: dbRecord.gestureEnabled,
        voiceEnabled:   dbRecord.voiceEnabled
      }
      // Merge any extra keys stored in customSettings
      try {
        const extra = JSON.parse(dbRecord.customSettings || '{}')
        // Exclude internal passwordHash from profile response
        delete extra.passwordHash
        Object.assign(profile, extra)
      } catch (_) {}
      return res.json(profile)
    }

    // No DB record yet — return default preset
    const profileName = req.session?.profileName || 'default'
    res.json({ profileName, ...PRESETS[profileName] || PRESETS.default })
  } catch (err) {
    console.error('[Profile] GET error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/profile — upsert profile to DB
router.post('/', async (req, res) => {
  try {
    const userName = req.session.userName
    const {
      profileName = 'default',
      fontSize, contrast, cursorSize, theme,
      gestureEnabled, voiceEnabled,
      ...rest   // remaining keys stored in customSettings
    } = req.body

    if (!PRESETS[profileName]) {
      return res.status(400).json({ error: 'Invalid profile name' })
    }

    const preset = PRESETS[profileName]

    // Preserve existing passwordHash in customSettings
    let existingSettings = {}
    try {
      const existing = await prisma.userProfile.findUnique({ where: { userName } })
      if (existing) existingSettings = JSON.parse(existing.customSettings || '{}')
    } catch (_) {}

    const customSettings = JSON.stringify({
      ...existingSettings,
      ...rest
    })

    const saved = await prisma.userProfile.upsert({
      where:  { userName },
      create: {
        userName,
        profileName,
        fontSize:       fontSize       ?? preset.fontSize,
        contrast:       contrast       ?? preset.contrast,
        cursorSize:     cursorSize     ?? preset.cursorSize,
        theme:          theme          ?? preset.theme,
        gestureEnabled: gestureEnabled ?? preset.gestureEnabled,
        voiceEnabled:   voiceEnabled   ?? preset.voiceEnabled,
        customSettings
      },
      update: {
        profileName,
        ...(fontSize       !== undefined && { fontSize }),
        ...(contrast       !== undefined && { contrast }),
        ...(cursorSize     !== undefined && { cursorSize }),
        ...(theme          !== undefined && { theme }),
        ...(gestureEnabled !== undefined && { gestureEnabled }),
        ...(voiceEnabled   !== undefined && { voiceEnabled }),
        customSettings
      }
    })

    req.session.profileName = profileName
    res.json({ profileName: saved.profileName, ...preset })
  } catch (err) {
    console.error('[Profile] POST error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/profile/presets — no auth required for preset list
router.get('/presets', (req, res) => {
  res.json(PRESETS)
})

module.exports = router
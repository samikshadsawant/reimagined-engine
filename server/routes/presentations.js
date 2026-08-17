/**
 * Presentation Routes — backed by Prisma + filesystem export
 *
 * Mounted at /api/presentations in server/index.js
 *
 * Endpoints:
 *   GET    /api/presentations           — List all (builtins + user's own)
 *   GET    /api/presentations/:id       — Get one (with slides)
 *   POST   /api/presentations           — Create new deck
 *   PUT    /api/presentations/:id       — Update deck (title/description/slides)
 *   DELETE /api/presentations/:id       — Delete (builtins protected)
 *   POST   /api/presentations/seed      — Reseed builtin demo decks
 *
 * Auth: optional. Anonymous users see builtins; authenticated users
 * additionally see their own decks.
 */

const express = require('express')
const router  = express.Router()
const { z }   = require('zod')
const prisma  = require('../lib/prisma')
const { optionalAuth } = require('../middleware/auth')

router.use(optionalAuth)

// ── Validation ────────────────────────────────────────────────────────────────
const slideSchema = z.object({
  title: z.string().max(200).optional().default(''),
  body:  z.string().max(5000).optional().default(''),
  image: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  layout: z.enum(['title', 'content', 'image', 'split', 'quote']).optional().default('content')
})

const createSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  slides:      z.array(slideSchema).max(200).optional().default([]),
  thumbnail:   z.string().max(2000).optional()
})

const updateSchema = createSchema.partial()

// ── Builtin demo decks ────────────────────────────────────────────────────────
// These ship with every install. They cover three audiences our project targets:
//   1. First-time users (welcome tour)
//   2. Elderly users (daily wellness tips)
//   3. Caregivers / accessibility advocates (project overview)
const BUILTIN_DECKS = [
  {
    title: 'Welcome to SpiritOS',
    description: 'A gentle 5-minute tour for first-time users.',
    slides: [
      { layout: 'title',   title: 'Welcome to SpiritOS', body: 'An operating system designed for everyone.', notes: 'Read with a warm tone.' },
      { layout: 'content', title: 'You are in control', body: 'Use your voice, your hands, or just your eyes. Whatever feels easiest is fine here.' },
      { layout: 'content', title: 'Apps live on the dock', body: 'The row of icons at the bottom is your dock. Tap any icon to open an app. Tap again to bring it back.' },
      { layout: 'content', title: 'Say what you want', body: 'Turn on the microphone and say things like "open notes" or "what time is it". The OS will listen and reply.' },
      { layout: 'content', title: 'Wave to navigate', body: 'Turn on hand control. Show a thumbs-up to open File Explorer. Show your open palm to open Notes.' },
      { layout: 'content', title: 'A help button is always near', body: 'If you ever feel lost, press the round Help button at the bottom-right. We will guide you again.' },
      { layout: 'quote',   title: 'Take your time',     body: 'Computers should adapt to people. Not the other way around.' }
    ]
  },
  {
    title: 'Daily Wellness Tips',
    description: 'Gentle daily reminders for healthy living. Made for older adults.',
    slides: [
      { layout: 'title',   title: 'Daily Wellness',     body: 'Small habits, big difference.' },
      { layout: 'content', title: 'Drink water often',  body: 'Aim for one glass of water with each meal and one between meals. Hydration helps memory and energy.' },
      { layout: 'content', title: 'Move every hour',    body: 'Stand up, stretch, walk a little. Just two minutes of movement every hour keeps joints happy.' },
      { layout: 'content', title: 'Eat colourful food', body: 'Try to have at least three colours on your plate. Fruits and vegetables protect the heart and brain.' },
      { layout: 'content', title: 'Talk to someone',    body: 'A short phone call with family or a neighbour lifts your mood. SpiritOS can dial for you — just ask.' },
      { layout: 'content', title: 'Take meds on time',  body: 'Open the Reminders app. Add the time you take each medicine. The OS will gently remind you.' },
      { layout: 'content', title: 'Rest your eyes',     body: 'Every 20 minutes, look 20 feet away for 20 seconds. This rule keeps eyes from getting tired.' },
      { layout: 'quote',   title: 'You are doing great', body: 'Caring for yourself is the most important task of the day.' }
    ]
  },
  {
    title: 'How SpiritOS Helps Everyone',
    description: 'A short overview of accessibility features in this OS.',
    slides: [
      { layout: 'title',   title: 'SpiritOS for All',   body: 'Inclusion is the default, not an add-on.' },
      { layout: 'content', title: 'Voice commands',     body: 'Continuous listening with multilingual support. Open apps, change settings, search the web — all by speaking.' },
      { layout: 'content', title: 'Hand gestures',      body: 'MediaPipe + YOLOv8 detect 8 gestures. Move the cursor, click, swipe, and launch apps without a mouse.' },
      { layout: 'content', title: 'Eye tracking',       body: 'A 9-point regression calibration turns your gaze into a cursor. Dwell on something to click it.' },
      { layout: 'content', title: 'Accessibility profiles', body: 'One click switches the entire UI to suit elderly, low-vision, or motor-impaired users.' },
      { layout: 'content', title: 'Memory support',     body: 'Phase-based reminders, face recognition for known people, gentle prompts. Built for users with Alzheimer\'s.' },
      { layout: 'content', title: 'Always-on help',     body: 'Ask Spirit, the AI assistant, anything. It can open apps, find files, translate, or just talk.' },
      { layout: 'quote',   title: 'Technology meets people where they are.', body: '' }
    ]
  }
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function serialize(p) {
  let slides = []
  try { slides = JSON.parse(p.slides || '[]') } catch (_) {}
  return {
    id:          p.id,
    title:       p.title,
    description: p.description,
    slides,
    slideCount:  slides.length,
    isBuiltin:   p.isBuiltin,
    thumbnail:   p.thumbnail,
    isMine:      !p.isBuiltin && p.userName !== 'public',
    createdAt:   p.createdAt,
    updatedAt:   p.updatedAt
  }
}

async function ensureBuiltins() {
  const existing = await prisma.presentation.count({ where: { isBuiltin: true } })
  if (existing >= BUILTIN_DECKS.length) return
  // Replace builtins so updates to BUILTIN_DECKS take effect on next start
  await prisma.presentation.deleteMany({ where: { isBuiltin: true } })
  for (const deck of BUILTIN_DECKS) {
    await prisma.presentation.create({
      data: {
        userName:    'public',
        title:       deck.title,
        description: deck.description,
        slides:      JSON.stringify(deck.slides),
        isBuiltin:   true
      }
    })
  }
  console.log(`📊 Seeded ${BUILTIN_DECKS.length} builtin presentation decks`)
}

// Seed at startup (fire-and-forget)
ensureBuiltins().catch(err => console.warn('[Presentations] seed failed:', err.message))

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/presentations
router.get('/', async (req, res) => {
  try {
    const userName = req.session?.userName || null
    const where = userName
      ? { OR: [{ isBuiltin: true }, { userName }] }
      : { isBuiltin: true }
    const list = await prisma.presentation.findMany({
      where,
      orderBy: [{ isBuiltin: 'desc' }, { updatedAt: 'desc' }]
    })
    res.json(list.map(serialize))
  } catch (err) {
    console.error('[Presentations] GET error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/presentations/:id
router.get('/:id', async (req, res) => {
  try {
    const userName = req.session?.userName || null
    const deck = await prisma.presentation.findUnique({ where: { id: req.params.id } })
    if (!deck) return res.status(404).json({ error: 'Presentation not found' })
    // Builtins are public; others must belong to caller
    if (!deck.isBuiltin && deck.userName !== 'public' && deck.userName !== userName) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    res.json(serialize(deck))
  } catch (err) {
    console.error('[Presentations] GET single error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations
router.post('/', async (req, res) => {
  try {
    const userName = req.session?.userName || null
    if (!userName) return res.status(401).json({ error: 'Login required to save decks' })
    const data = createSchema.parse(req.body)
    const deck = await prisma.presentation.create({
      data: {
        userName,
        title:       data.title,
        description: data.description || null,
        slides:      JSON.stringify(data.slides || []),
        thumbnail:   data.thumbnail || null,
        isBuiltin:   false
      }
    })
    res.status(201).json(serialize(deck))
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    console.error('[Presentations] POST error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/presentations/:id
router.put('/:id', async (req, res) => {
  try {
    const userName = req.session?.userName || null
    const existing = await prisma.presentation.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Presentation not found' })
    if (existing.isBuiltin) return res.status(403).json({ error: 'Builtin decks are read-only' })
    if (existing.userName !== userName) return res.status(403).json({ error: 'Forbidden' })

    const data = updateSchema.parse(req.body)
    const updated = await prisma.presentation.update({
      where: { id: req.params.id },
      data: {
        ...(data.title       !== undefined && { title:       data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.thumbnail   !== undefined && { thumbnail:   data.thumbnail }),
        ...(data.slides      !== undefined && { slides:      JSON.stringify(data.slides) })
      }
    })
    res.json(serialize(updated))
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    console.error('[Presentations] PUT error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/presentations/:id
router.delete('/:id', async (req, res) => {
  try {
    const userName = req.session?.userName || null
    const existing = await prisma.presentation.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Presentation not found' })
    if (existing.isBuiltin) return res.status(403).json({ error: 'Builtin decks cannot be deleted' })
    if (existing.userName !== userName) return res.status(403).json({ error: 'Forbidden' })
    await prisma.presentation.delete({ where: { id: req.params.id } })
    res.json({ deleted: true })
  } catch (err) {
    console.error('[Presentations] DELETE error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations/seed — admin/dev hook to refresh builtins
router.post('/seed', async (_req, res) => {
  try {
    await prisma.presentation.deleteMany({ where: { isBuiltin: true } })
    for (const deck of BUILTIN_DECKS) {
      await prisma.presentation.create({
        data: {
          userName:    'public',
          title:       deck.title,
          description: deck.description,
          slides:      JSON.stringify(deck.slides),
          isBuiltin:   true
        }
      })
    }
    res.json({ seeded: BUILTIN_DECKS.length })
  } catch (err) {
    console.error('[Presentations] seed error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

/**
 * Reminders Routes — meds + appointments + daily tasks
 * Mounted at /api/reminders
 *
 * GET    /api/reminders              — list user's reminders
 * POST   /api/reminders              — create
 * PUT    /api/reminders/:id          — update
 * DELETE /api/reminders/:id          — delete
 * POST   /api/reminders/:id/fire     — record that a reminder fired
 *
 * Auth: optional. Anonymous users get a stable per-session pseudo userName
 * so reminders persist within a session even without login.
 */

const express = require('express')
const router  = express.Router()
const { z }   = require('zod')
const prisma  = require('../lib/prisma')

// ── Helpers ───────────────────────────────────────────────────────────────────
function effectiveUser(req) {
  if (req.session?.userName) return req.session.userName
  // Stable anonymous fallback so the user can still create reminders without
  // creating an account. Cookie-backed via express-session.
  if (!req.session.anonId) {
    req.session.anonId = 'anon_' + Math.random().toString(36).slice(2, 10)
  }
  return req.session.anonId
}

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/
const daysRegex = /^[01]{7}$/

const createSchema = z.object({
  title:      z.string().min(1).max(120),
  body:       z.string().max(500).optional(),
  timeOfDay:  z.string().regex(timeRegex, 'HH:mm format required'),
  daysMask:   z.string().regex(daysRegex).optional().default('1111111'),
  enabled:    z.boolean().optional().default(true),
  speakAloud: z.boolean().optional().default(true)
})

const updateSchema = createSchema.partial()

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const userName = effectiveUser(req)
    const items = await prisma.reminder.findMany({
      where: { userName },
      orderBy: { timeOfDay: 'asc' }
    })
    res.json(items)
  } catch (err) {
    console.error('[Reminders] GET error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const userName = effectiveUser(req)
    const data = createSchema.parse(req.body)
    const created = await prisma.reminder.create({
      data: { userName, ...data }
    })
    res.status(201).json(created)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    console.error('[Reminders] POST error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const userName = effectiveUser(req)
    const existing = await prisma.reminder.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Reminder not found' })
    if (existing.userName !== userName) return res.status(403).json({ error: 'Forbidden' })
    const data = updateSchema.parse(req.body)
    const updated = await prisma.reminder.update({ where: { id: req.params.id }, data })
    res.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    console.error('[Reminders] PUT error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const userName = effectiveUser(req)
    const existing = await prisma.reminder.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Reminder not found' })
    if (existing.userName !== userName) return res.status(403).json({ error: 'Forbidden' })
    await prisma.reminder.delete({ where: { id: req.params.id } })
    res.json({ deleted: true })
  } catch (err) {
    console.error('[Reminders] DELETE error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Mark a reminder as fired (used by client-side scheduler so we don't repeat).
router.post('/:id/fire', async (req, res) => {
  try {
    const userName = effectiveUser(req)
    const existing = await prisma.reminder.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Reminder not found' })
    if (existing.userName !== userName) return res.status(403).json({ error: 'Forbidden' })
    const updated = await prisma.reminder.update({
      where: { id: req.params.id },
      data:  { lastFiredAt: new Date() }
    })
    res.json(updated)
  } catch (err) {
    console.error('[Reminders] fire error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

/**
 * EmergencyContact Routes — for the SOS button
 * Mounted at /api/emergency
 *
 * GET    /api/emergency       — list contacts (sorted by priority)
 * POST   /api/emergency       — add contact
 * PUT    /api/emergency/:id   — update
 * DELETE /api/emergency/:id   — remove
 *
 * Auth: optional (same anon fallback as reminders).
 */

const express = require('express')
const router  = express.Router()
const { z }   = require('zod')
const prisma  = require('../lib/prisma')

function effectiveUser(req) {
  if (req.session?.userName) return req.session.userName
  if (!req.session.anonId) req.session.anonId = 'anon_' + Math.random().toString(36).slice(2, 10)
  return req.session.anonId
}

const createSchema = z.object({
  name:         z.string().min(1).max(120),
  relationship: z.string().max(80).optional(),
  // Phone validation: 6–20 chars, digits / + / spaces / - / parens only
  phone:        z.string().min(6).max(20).regex(/^[\d+\-\s()]+$/, 'Invalid phone number'),
  priority:     z.coerce.number().int().min(0).max(99).optional().default(0),
  notes:        z.string().max(500).optional()
})

const updateSchema = createSchema.partial()

router.get('/', async (req, res) => {
  try {
    const userName = effectiveUser(req)
    const list = await prisma.emergencyContact.findMany({
      where: { userName },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }]
    })
    res.json(list)
  } catch (err) {
    console.error('[Emergency] GET error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const userName = effectiveUser(req)
    const data = createSchema.parse(req.body)
    const created = await prisma.emergencyContact.create({
      data: { userName, ...data }
    })
    res.status(201).json(created)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    console.error('[Emergency] POST error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const userName = effectiveUser(req)
    const existing = await prisma.emergencyContact.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Contact not found' })
    if (existing.userName !== userName) return res.status(403).json({ error: 'Forbidden' })
    const data = updateSchema.parse(req.body)
    const updated = await prisma.emergencyContact.update({ where: { id: req.params.id }, data })
    res.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    console.error('[Emergency] PUT error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const userName = effectiveUser(req)
    const existing = await prisma.emergencyContact.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Contact not found' })
    if (existing.userName !== userName) return res.status(403).json({ error: 'Forbidden' })
    await prisma.emergencyContact.delete({ where: { id: req.params.id } })
    res.json({ deleted: true })
  } catch (err) {
    console.error('[Emergency] DELETE error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

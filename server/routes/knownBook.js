/**
 * server/routes/knownBook.js — Phase 2.2
 *
 * CRUD API for the KnownPerson (Known Book) feature.
 * Mounted at /api/known-book in server/index.js.
 *
 * Routes (exactly 5 — no more):
 *   POST   /api/known-book        — Create a person
 *   GET    /api/known-book        — List all for session user
 *   GET    /api/known-book/:id    — Single record
 *   PUT    /api/known-book/:id    — Update fields
 *   DELETE /api/known-book/:id    — Delete record
 *
 * FIX C2: Session key corrected — uses req.session.userName (not userId)
 * FIX C3: DELETE now returns 403 for ownership violations (not 404)
 * FIX M1: Uses shared PrismaClient from server/lib/prisma.js
 */

const express = require('express')
const router  = express.Router()
const prisma  = require('../lib/prisma') // FIX M1 — shared singleton, no duplicate connections

// ── Auth guard ────────────────────────────────────────────────────────────────
// Gracefully resolve userId from session or default to 'User'.
// SpiritOS does not enforce login, so we avoid 401 errors for
// unauthenticated requests from FaceRecognition / KnownBook UI.
function requireSession(req, res, next) {
  const userName = req.session?.userName || req.query?.user || 'User'
  req.userId = userName
  next()
}

router.use(requireSession)

// ── POST /api/known-book ──────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, relationship, photoUrl, notes } = req.body
    if (!name || !relationship) {
      return res.status(400).json({ error: '`name` and `relationship` are required' })
    }
    const person = await prisma.knownPerson.create({
      data: {
        userId:       req.userId,
        name,
        relationship,
        photoUrl:     photoUrl  || null,
        notes:        notes     || null
      }
    })
    res.status(201).json(person)
  } catch (err) {
    console.error('[KnownBook] POST error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/known-book ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const people = await prisma.knownPerson.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' }
    })
    res.json(people)
  } catch (err) {
    console.error('[KnownBook] GET list error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/known-book/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const id     = parseInt(req.params.id, 10)
    const person = await prisma.knownPerson.findFirst({
      where: { id, userId: req.userId }
    })
    if (!person) return res.status(404).json({ error: 'Person not found' })
    res.json(person)
  } catch (err) {
    console.error('[KnownBook] GET single error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /api/known-book/:id ───────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)

    // Verify ownership before updating
    const existing = await prisma.knownPerson.findFirst({ where: { id, userId: req.userId } })
    if (!existing) return res.status(404).json({ error: 'Person not found' })

    // Only allow updating writable fields — never overwrite userId
    const { name, relationship, photoUrl, notes, faceDescriptor, recognitionCount, lastRecognized } = req.body
    const data = {}
    if (name             !== undefined) data.name             = name
    if (relationship     !== undefined) data.relationship     = relationship
    if (photoUrl         !== undefined) data.photoUrl         = photoUrl
    if (notes            !== undefined) data.notes            = notes
    if (faceDescriptor   !== undefined) data.faceDescriptor   = faceDescriptor
    if (recognitionCount !== undefined) data.recognitionCount = parseInt(recognitionCount, 10)
    if (lastRecognized   !== undefined) data.lastRecognized   = new Date(lastRecognized)

    const updated = await prisma.knownPerson.update({ where: { id }, data })
    res.json(updated)
  } catch (err) {
    console.error('[KnownBook] PUT error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/known-book/:id ────────────────────────────────────────────────
// FIX C3: Two-step check — 404 if record doesn't exist, 403 if wrong owner
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)

    // Step 1: check record exists at all
    const record = await prisma.knownPerson.findUnique({ where: { id } })
    if (!record) return res.status(404).json({ error: 'Person not found' })

    // Step 2: check ownership — FIX C3
    if (record.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden: you do not own this record' })
    }

    await prisma.knownPerson.delete({ where: { id } })
    res.json({ deleted: true })
  } catch (err) {
    console.error('[KnownBook] DELETE error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

/**
 * Vault Routes — Phase 4.2
 * Mounted at /api/vault
 *
 * All routes require the vault PIN in the request body.
 * The PIN is never stored — it's used transiently to derive the AES key.
 *
 * GET  /api/vault/status          — check if vault exists (no PIN needed)
 * POST /api/vault/unlock          — verify PIN + return entry count
 * POST /api/vault/entry           — add a new entry
 * GET  /api/vault/entry           — list entries (no secrets, PIN required)
 * POST /api/vault/entry/get       — retrieve a single entry with secret
 * PUT  /api/vault/entry           — update an entry's secret/notes
 * DELETE /api/vault/entry         — delete an entry
 * POST /api/vault/change-pin      — change the vault PIN
 */

const express = require('express')
const router  = express.Router()
const { z }   = require('zod')
const vault   = require('../lib/biometricVault')

const pinSchema = z.string().min(4).max(64)

// ── Status (no PIN needed) ────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json(vault.vaultStatus())
})

// ── Unlock / verify PIN ───────────────────────────────────────────────────────
router.post('/unlock', (req, res) => {
  try {
    const { pin } = z.object({ pin: pinSchema }).parse(req.body)
    const result = vault.vaultUnlock(pin)
    res.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    if (err.message.includes('Wrong PIN')) return res.status(401).json({ error: err.message })
    res.status(500).json({ error: err.message })
  }
})

// ── Add entry ─────────────────────────────────────────────────────────────────
router.post('/entry', (req, res) => {
  try {
    const schema = z.object({
      pin:      pinSchema,
      category: z.enum(vault.VALID_CATEGORIES).optional(),
      label:    z.string().min(1).max(200),
      secret:   z.string().min(1).max(2000),
      notes:    z.string().max(500).optional()
    })
    const { pin, ...data } = schema.parse(req.body)
    const result = vault.vaultAdd(pin, data)
    res.status(201).json(result)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    if (err.message.includes('Wrong PIN')) return res.status(401).json({ error: err.message })
    if (err.message.includes('already exists')) return res.status(409).json({ error: err.message })
    res.status(500).json({ error: err.message })
  }
})

// ── List entries (no secrets) ─────────────────────────────────────────────────
router.get('/entry', (req, res) => {
  try {
    const pin = req.headers['x-vault-pin'] || req.query.pin
    if (!pin) return res.status(400).json({ error: 'PIN required (x-vault-pin header or ?pin= query)' })
    const category = req.query.category
    const result = vault.vaultList(pin, category)
    res.json(result)
  } catch (err) {
    if (err.message.includes('Wrong PIN')) return res.status(401).json({ error: err.message })
    res.status(500).json({ error: err.message })
  }
})

// ── Get single entry with secret ──────────────────────────────────────────────
router.post('/entry/get', (req, res) => {
  try {
    const { pin, label } = z.object({
      pin:   pinSchema,
      label: z.string().min(1)
    }).parse(req.body)
    const result = vault.vaultGet(pin, label)
    res.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    if (err.message.includes('Wrong PIN')) return res.status(401).json({ error: err.message })
    if (err.message.includes('No vault entry')) return res.status(404).json({ error: err.message })
    res.status(500).json({ error: err.message })
  }
})

// ── Update entry ──────────────────────────────────────────────────────────────
router.put('/entry', (req, res) => {
  try {
    const { pin, label, secret, notes } = z.object({
      pin:    pinSchema,
      label:  z.string().min(1),
      secret: z.string().min(1).max(2000).optional(),
      notes:  z.string().max(500).optional()
    }).parse(req.body)
    const result = vault.vaultUpdate(pin, label, { secret, notes })
    res.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    if (err.message.includes('Wrong PIN')) return res.status(401).json({ error: err.message })
    if (err.message.includes('No vault entry')) return res.status(404).json({ error: err.message })
    res.status(500).json({ error: err.message })
  }
})

// ── Delete entry ──────────────────────────────────────────────────────────────
router.delete('/entry', (req, res) => {
  try {
    const { pin, label } = z.object({
      pin:   pinSchema,
      label: z.string().min(1)
    }).parse(req.body)
    const result = vault.vaultDelete(pin, label)
    res.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    if (err.message.includes('Wrong PIN')) return res.status(401).json({ error: err.message })
    if (err.message.includes('No vault entry')) return res.status(404).json({ error: err.message })
    res.status(500).json({ error: err.message })
  }
})

// ── Change PIN ────────────────────────────────────────────────────────────────
router.post('/change-pin', (req, res) => {
  try {
    const { old_pin, new_pin } = z.object({
      old_pin: pinSchema,
      new_pin: pinSchema
    }).parse(req.body)
    const result = vault.vaultChangePin(old_pin, new_pin)
    res.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    if (err.message.includes('Wrong PIN')) return res.status(401).json({ error: err.message })
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

/**
 * Memory Routes — Phase 3.1
 * Mounted at /api/memory
 *
 * POST /api/memory/save          — save a key/value to a category
 * GET  /api/memory/recall        — recall by key and/or category
 * GET  /api/memory/all           — dump all memories
 * DELETE /api/memory/:category/:key — delete a specific memory entry
 *
 * Backed by server/data/memory.json (same file irisTools.js uses).
 * No auth required — memories are global to the OS session.
 */

const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')
const { z }   = require('zod')

const MEM_PATH = path.join(__dirname, '..', 'data', 'memory.json')

const VALID_CATEGORIES = ['identity', 'preferences', 'projects', 'relationships', 'wishes', 'notes']

// ── Helpers ───────────────────────────────────────────────────────────────────

function readMem() {
  try {
    return JSON.parse(fs.readFileSync(MEM_PATH, 'utf-8'))
  } catch (_) {
    return {}
  }
}

function writeMem(mem) {
  fs.mkdirSync(path.dirname(MEM_PATH), { recursive: true })
  fs.writeFileSync(MEM_PATH, JSON.stringify(mem, null, 2), 'utf-8')
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const saveSchema = z.object({
  category: z.enum(VALID_CATEGORIES),
  key:      z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'snake_case key required'),
  value:    z.string().min(1).max(1000)
})

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/memory/save
 * Body: { category, key, value }
 */
router.post('/save', (req, res) => {
  try {
    const { category, key, value } = saveSchema.parse(req.body)
    const mem = readMem()
    if (!mem[category]) mem[category] = {}
    mem[category][key] = { value, ts: new Date().toISOString() }
    writeMem(mem)
    res.json({ saved: `${category}/${key}`, category, key, value })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    console.error('[Memory] save error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/memory/recall?key=...&category=...
 * Both params optional. Returns matching entries.
 */
router.get('/recall', (req, res) => {
  try {
    const { key, category } = req.query
    const mem = readMem()

    // Category + key → single entry
    if (category && key) {
      const entry = mem[category]?.[key]
      if (!entry) return res.status(404).json({ error: `No memory: ${category}/${key}` })
      return res.json({ category, key, value: entry.value, ts: entry.ts })
    }

    // Category only → all entries in that category
    if (category) {
      const entries = mem[category] || {}
      return res.json({
        category,
        memories: Object.entries(entries).map(([k, v]) => ({ key: k, value: v.value, ts: v.ts }))
      })
    }

    // Key only → search all categories
    if (key) {
      for (const [cat, entries] of Object.entries(mem)) {
        if (entries[key]) {
          return res.json({ category: cat, key, value: entries[key].value, ts: entries[key].ts })
        }
      }
      return res.status(404).json({ error: `No memory found for key: ${key}` })
    }

    // No params → return everything (same as /all)
    const all = []
    for (const [cat, entries] of Object.entries(mem)) {
      for (const [k, v] of Object.entries(entries)) {
        all.push({ category: cat, key: k, value: v.value, ts: v.ts })
      }
    }
    res.json({ memories: all, total: all.length })
  } catch (err) {
    console.error('[Memory] recall error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/memory/all
 * Returns all memories grouped by category.
 */
router.get('/all', (req, res) => {
  try {
    const mem = readMem()
    const grouped = {}
    let total = 0

    for (const cat of VALID_CATEGORIES) {
      const entries = mem[cat] || {}
      grouped[cat] = Object.entries(entries).map(([k, v]) => ({
        key: k, value: v.value, ts: v.ts
      }))
      total += grouped[cat].length
    }

    res.json({ memories: grouped, total, categories: VALID_CATEGORIES })
  } catch (err) {
    console.error('[Memory] all error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * DELETE /api/memory/:category/:key
 */
router.delete('/:category/:key', (req, res) => {
  try {
    const { category, key } = req.params
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category: ${category}` })
    }
    const mem = readMem()
    if (!mem[category]?.[key]) {
      return res.status(404).json({ error: `No memory: ${category}/${key}` })
    }
    delete mem[category][key]
    writeMem(mem)
    res.json({ deleted: true, category, key })
  } catch (err) {
    console.error('[Memory] delete error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * DELETE /api/memory/clear/:category
 * Wipe an entire category.
 */
router.delete('/clear/:category', (req, res) => {
  try {
    const { category } = req.params
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category: ${category}` })
    }
    const mem = readMem()
    const count = Object.keys(mem[category] || {}).length
    mem[category] = {}
    writeMem(mem)
    res.json({ cleared: true, category, deletedCount: count })
  } catch (err) {
    console.error('[Memory] clear error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

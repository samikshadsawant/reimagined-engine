/**
 * Search Routes — Phase 3.2
 * Mounted at /api/search
 *
 * POST /api/search/index          — index a file or directory
 * POST /api/search/query          — semantic search
 * GET  /api/search/stats          — index statistics
 * DELETE /api/search/index        — clear the index
 * POST /api/search/parse          — parse a document to text
 */

const express = require('express')
const router  = express.Router()
const { z }   = require('zod')
const vs      = require('../lib/vectorSearch')
const { parseDocument, getParserStatus } = require('../lib/docParser')
const path    = require('path')
const _process = require('process')

function fsRoot() {
  const raw = _process.env.FS_ROOT
  if (raw) return require('path').resolve(raw)
  return require('os').homedir()
}

// ── Index a file or directory ─────────────────────────────────────────────────

router.post('/index', async (req, res) => {
  try {
    const { target_path, recursive = true } = z.object({
      target_path: z.string().min(1),
      recursive:   z.boolean().optional().default(true)
    }).parse(req.body)

    const root = fsRoot()
    const resolved = path.resolve(root, target_path)
    if (!resolved.startsWith(root)) return res.status(400).json({ error: 'Path traversal blocked' })

    const fs = require('fs')
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Path not found' })

    const stat = fs.statSync(resolved)
    if (stat.isDirectory()) {
      const stats = await vs.indexDirectory(resolved, recursive ? 4 : 0)
      res.json({ type: 'directory', path: resolved, ...stats })
    } else {
      const result = await vs.indexFile(resolved)
      res.json({ type: 'file', ...result })
    }
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    console.error('[Search] index error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Semantic search ───────────────────────────────────────────────────────────

router.post('/query', async (req, res) => {
  try {
    const { query, top_k = 5, min_score = 0.5 } = z.object({
      query:     z.string().min(1).max(500),
      top_k:     z.number().int().min(1).max(20).optional().default(5),
      min_score: z.number().min(0).max(1).optional().default(0.5)
    }).parse(req.body)

    const results = await vs.search(query, top_k, min_score)
    res.json({ query, results, count: results.length })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    console.error('[Search] query error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Index stats ───────────────────────────────────────────────────────────────

router.get('/stats', (req, res) => {
  try {
    const stats = vs.getIndexStats()
    const parsers = getParserStatus()
    res.json({ ...stats, parsers })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Clear index ───────────────────────────────────────────────────────────────

router.delete('/index', (req, res) => {
  try {
    vs.clearIndex()
    res.json({ cleared: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Parse document ────────────────────────────────────────────────────────────

router.post('/parse', async (req, res) => {
  try {
    const { file_path } = z.object({
      file_path: z.string().min(1)
    }).parse(req.body)

    const result = await parseDocument(file_path)
    // Truncate text in response to avoid huge payloads
    res.json({
      ...result,
      text:    result.text.slice(0, 5000),
      length:  result.text.length,
      truncated: result.text.length > 5000
    })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    console.error('[Search] parse error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

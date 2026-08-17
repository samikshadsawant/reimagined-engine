/**
 * server/lib/vectorSearch.js — Phase 3.2
 *
 * Semantic vector search over the local filesystem using:
 *   - Gemini text-embedding-004 for generating embeddings
 *   - In-memory cosine similarity search (no external DB needed)
 *   - Persistent index stored as JSON in server/data/vectorIndex.json
 *
 * Why not LanceDB?
 *   LanceDB requires native binaries that are platform-specific and
 *   often fail on Windows without extra build tooling. The JSON-based
 *   approach is zero-dependency, works everywhere, and is fast enough
 *   for a local OS (hundreds of files, not millions).
 *
 * Usage:
 *   const vs = require('./vectorSearch')
 *   await vs.indexDirectory('/path/to/dir')
 *   const results = await vs.search('find notes about my project')
 */

const fs   = require('fs')
const path = require('path')
const _process = require('process')

const INDEX_PATH = path.join(__dirname, '..', 'data', 'vectorIndex.json')
const EMBED_MODEL = 'text-embedding-004'
const MAX_FILE_SIZE = 100 * 1024  // 100 KB per file
const SUPPORTED_EXTS = ['.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.json', '.py', '.html', '.css', '.csv', '.xml', '.yaml', '.yml']

// ── In-memory index ──────────────────────────────────────────────────────────
// Structure: [{ id, path, content_preview, embedding: number[], ts }]
let index = []
let indexLoaded = false

// ── Persistence ──────────────────────────────────────────────────────────────

function loadIndex() {
  if (indexLoaded) return
  try {
    const raw = fs.readFileSync(INDEX_PATH, 'utf-8')
    index = JSON.parse(raw)
    console.log(`[VectorSearch] Loaded ${index.length} entries from index`)
  } catch (_) {
    index = []
  }
  indexLoaded = true
}

function saveIndex() {
  try {
    fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true })
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8')
  } catch (err) {
    console.warn('[VectorSearch] Failed to save index:', err.message)
  }
}

// ── Gemini Embeddings ─────────────────────────────────────────────────────────

async function getEmbedding(text) {
  const apiKey = _process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set — cannot generate embeddings')

  // Truncate to ~8000 chars (Gemini embedding limit)
  const truncated = text.slice(0, 8000)

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: truncated }] }
      })
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Embedding API error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.embedding?.values || null
}

// ── Cosine Similarity ─────────────────────────────────────────────────────────

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// ── File Indexing ─────────────────────────────────────────────────────────────

/**
 * Index a single file. Skips if already indexed and unchanged.
 * @param {string} filePath - Absolute path to file
 * @returns {{ indexed: boolean, path: string, reason?: string }}
 */
async function indexFile(filePath) {
  loadIndex()

  const ext = path.extname(filePath).toLowerCase()
  if (!SUPPORTED_EXTS.includes(ext)) {
    return { indexed: false, path: filePath, reason: 'unsupported extension' }
  }

  let stat
  try {
    stat = fs.statSync(filePath)
  } catch (_) {
    return { indexed: false, path: filePath, reason: 'file not found' }
  }

  if (stat.size > MAX_FILE_SIZE) {
    return { indexed: false, path: filePath, reason: 'file too large' }
  }

  const ts = stat.mtimeMs.toString()

  // Check if already indexed and up-to-date
  const existing = index.find(e => e.path === filePath)
  if (existing && existing.ts === ts) {
    return { indexed: false, path: filePath, reason: 'already up-to-date' }
  }

  let content
  try {
    content = fs.readFileSync(filePath, 'utf-8')
  } catch (_) {
    return { indexed: false, path: filePath, reason: 'read error' }
  }

  if (!content.trim()) {
    return { indexed: false, path: filePath, reason: 'empty file' }
  }

  try {
    const embedding = await getEmbedding(content)
    if (!embedding) return { indexed: false, path: filePath, reason: 'no embedding returned' }

    const entry = {
      id:              filePath,
      path:            filePath,
      name:            path.basename(filePath),
      ext,
      content_preview: content.slice(0, 300).replace(/\s+/g, ' '),
      embedding,
      ts,
      size:            stat.size
    }

    // Replace or add
    const idx = index.findIndex(e => e.path === filePath)
    if (idx >= 0) {
      index[idx] = entry
    } else {
      index.push(entry)
    }

    saveIndex()
    return { indexed: true, path: filePath }
  } catch (err) {
    return { indexed: false, path: filePath, reason: err.message }
  }
}

/**
 * Index all supported files in a directory (recursive, up to depth 4).
 * @param {string} dirPath - Absolute path to directory
 * @param {number} maxDepth - Max recursion depth (default 4)
 * @returns {{ indexed: number, skipped: number, errors: number, total: number }}
 */
async function indexDirectory(dirPath, maxDepth = 4) {
  loadIndex()

  const stats = { indexed: 0, skipped: 0, errors: 0, total: 0 }

  async function walk(dir, depth) {
    if (depth > maxDepth) return
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (_) {
      return
    }

    for (const entry of entries) {
      // Skip hidden files/dirs and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue

      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1)
      } else if (entry.isFile()) {
        stats.total++
        const result = await indexFile(fullPath)
        if (result.indexed) {
          stats.indexed++
        } else if (result.reason === 'read error') {
          stats.errors++
        } else {
          stats.skipped++
        }
        // Small delay to avoid hammering the embedding API
        if (result.indexed) await new Promise(r => setTimeout(r, 200))
      }
    }
  }

  await walk(dirPath, 0)
  return stats
}

/**
 * Semantic search over the indexed files.
 * @param {string} query - Natural language query
 * @param {number} topK - Number of results to return (default 5)
 * @param {number} minScore - Minimum similarity score (default 0.5)
 * @returns {Array<{ path, name, score, preview }>}
 */
async function search(query, topK = 5, minScore = 0.5) {
  loadIndex()

  if (index.length === 0) {
    return []
  }

  const queryEmbedding = await getEmbedding(query)
  if (!queryEmbedding) return []

  const scored = index
    .map(entry => ({
      path:    entry.path,
      name:    entry.name,
      ext:     entry.ext,
      preview: entry.content_preview,
      score:   cosineSimilarity(queryEmbedding, entry.embedding)
    }))
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  return scored
}

/**
 * Remove a file from the index.
 * @param {string} filePath
 */
function removeFromIndex(filePath) {
  loadIndex()
  const before = index.length
  index = index.filter(e => e.path !== filePath)
  if (index.length !== before) saveIndex()
}

/**
 * Get index statistics.
 */
function getIndexStats() {
  loadIndex()
  const byExt = {}
  for (const entry of index) {
    byExt[entry.ext] = (byExt[entry.ext] || 0) + 1
  }
  return {
    totalFiles: index.length,
    byExtension: byExt,
    indexPath: INDEX_PATH,
    hasGeminiKey: !!_process.env.GEMINI_API_KEY
  }
}

/**
 * Clear the entire index.
 */
function clearIndex() {
  index = []
  indexLoaded = true
  saveIndex()
}

module.exports = {
  indexFile,
  indexDirectory,
  search,
  removeFromIndex,
  getIndexStats,
  clearIndex
}

/**
 * Filesystem Routes
 * All routes prefixed with /api/fs
 *
 * IMPORTANT: Set DEMO_FS_ROOT in .env to point to your real filesystem
 * Examples:
 *   - ./demo-filesystem (sandboxed demo)
 *   - C:/Users/YourName/Documents
 *   - D:/Projects
 */

const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs')
const os = require('os')
const { z } = require('zod')
const { dfsTraverse, searchTree, flattenTree, getStats } = require('../lib/dfs')
const { runRules } = require('../lib/workflow')
const scopePermissions = require('../middleware/scopePermissions') // Phase 4.2
const prisma = require('../lib/prisma')                            // FIX 1 — FileActivity audit log

// scopePermissions is applied ONLY to write/mutating routes below (not reads)
// See: middleware/scopePermissions.js

// Filesystem root — real local system
// Set FS_ROOT in .env to override (e.g. FS_ROOT=D:\Projects)
let FS_ROOT = process.env.FS_ROOT || process.env.DEMO_FS_ROOT || os.homedir()

// If relative path, make it absolute
if (!path.isAbsolute(FS_ROOT)) {
  FS_ROOT = path.resolve(__dirname, '../../', FS_ROOT)
}

// Fallback if path doesn't exist
if (!fs.existsSync(FS_ROOT)) {
  FS_ROOT = os.homedir()
}

// Backward compat alias
const DEMO_FS_ROOT = FS_ROOT
console.log(`📁 Filesystem root: ${FS_ROOT}`)

// ── Security: strict root containment check ───────────────────────────────────
// Returns true when resolved is exactly FS_ROOT or a strict descendant.
// Uses path.sep so "/home/user-evil" does NOT pass for root "/home/user".
function isInsideRoot(resolved) {
  const root = path.resolve(FS_ROOT)
  const target = path.resolve(resolved)
  return target === root || target.startsWith(root + path.sep)
}

// Throws 403-style Error when path escapes the root.
function assertInsideRoot(resolved, label) {
  if (!isInsideRoot(resolved)) {
    const err = new Error(`Access denied: ${label || 'path'} is outside the filesystem root`)
    err.status = 403
    throw err
  }
}

// Helper: send error response respecting err.status (so 403 from assertInsideRoot
// is not accidentally downgraded to 400).
function sendErr(res, err, fallbackStatus = 400) {
  const status = err.status || fallbackStatus
  res.status(status).json({ error: err.message })
}

// Configurable limits
const MAX_DEPTH_DEFAULT = parseInt(process.env.MAX_TREE_DEPTH) || 4
const TREE_CACHE_TTL = parseInt(process.env.TREE_CACHE_TTL) || 5000

// Helper: get Windows drive letters
function getWindowsDrives() {
  if (process.platform !== 'win32') return []
  try {
    const { execSync } = require('child_process')
    const output = execSync('wmic logicaldisk get caption', { encoding: 'utf8' })
    return output.split('\n').map(l => l.trim()).filter(l => /^[A-Z]:$/.test(l))
      .map(d => ({ name: d + '\\', path: d + '/', type: 'directory', size: 0, modified: new Date().toISOString(), extension: null }))
  } catch { return [] }
}

// Tree cache for search performance - avoids repeated DFS traversal
const treeCache = {
  tree: null,
  timestamp: 0,
  TTL: TREE_CACHE_TTL
}

function getCachedTree() {
  const now = Date.now()
  if (treeCache.tree && (now - treeCache.timestamp) < treeCache.TTL) {
    return treeCache.tree
  }
  treeCache.tree = dfsTraverse(DEMO_FS_ROOT)
  treeCache.timestamp = now
  return treeCache.tree
}

// Validation schemas
const createSchema = z.object({
  path: z.string().optional(),
  name: z.string(),
  type: z.enum(['file', 'directory']),
  content: z.string().optional()
})

const deleteSchema = z.object({
  path: z.string()
})

const renameSchema = z.object({
  oldPath: z.string(),
  newName: z.string()
})

const writeSchema = z.object({
  path: z.string(),
  content: z.string()
})

const moveSchema = z.object({
  sourcePath: z.string(),
  destPath: z.string()
})

// Helper: resolve and validate path
function resolvePath(inputPath) {
  try {
    let rawPath = inputPath || ''
    let cleanPath = decodeURIComponent(rawPath)
    cleanPath = cleanPath.replace(/^[\\\/]+|[\\\/]+$/g, '')

    // Empty = FS root (user home)
    if (!cleanPath) {
      return FS_ROOT
    }

    // Windows drive path (e.g. "C:", "D:/Users")
    if (/^[A-Za-z]:/.test(cleanPath)) {
      return path.resolve(cleanPath + '/')
    }

    // Absolute path
    if (path.isAbsolute(cleanPath)) {
      return path.resolve(cleanPath)
    }

    // Relative to FS_ROOT
    return path.resolve(path.join(FS_ROOT, cleanPath))
  } catch (err) {
    console.error('[resolvePath] Error:', err.message, 'input:', inputPath)
    throw err
  }
}

// GET /drives — list available drives (Windows)
// Helper to build consistent forward-slash paths for client display.
function buildDisplayPath(base, name) {
  const basePath = (!base || base === '/') ? '' : base.replace(/\/+$/, '')
  return basePath ? basePath + '/' + name : '/' + name
}

router.get('/drives', (req, res) => {
  const drives = getWindowsDrives()
  res.json({ drives, homePath: FS_ROOT.replace(/\\/g, '/') })
})

// GET /tree?path=&depth=
router.get('/tree', (req, res) => {
  try {
    const { path: reqPath, depth } = req.query
    const rootPath = resolvePath(reqPath || '')
    assertInsideRoot(rootPath, 'tree path')

    const tree = dfsTraverse(rootPath, {
      maxDepth: parseInt(depth) || MAX_DEPTH_DEFAULT,
      showHidden: false,
      includeMetadata: true
    })

    // Convert absolute paths to relative paths for the frontend
    const rootResolved = path.resolve(DEMO_FS_ROOT)
    function convertToRelative(node) {
      if (!node) return null
      const relativePath = path.relative(rootResolved, node.path).replace(/\\/g, '/')
      const relativePathWithSlash = relativePath ? '/' + relativePath : '/'
      return {
        ...node,
        path: relativePathWithSlash
      }
    }

    function processNode(node) {
      const relNode = convertToRelative(node)
      if (relNode.children) {
        relNode.children = relNode.children.map(processNode)
      }
      return relNode
    }

    const relativeTree = processNode(tree)
    res.json(relativeTree)
  } catch (err) {
    console.error('[TREE] Error:', err.message)
    sendErr(res, err)
  }
})

// Debug endpoint - test if fs is working
router.get('/debug', (req, res) => {
  res.json({
    demoFsRoot: DEMO_FS_ROOT,
    demoFsExists: fs.existsSync(DEMO_FS_ROOT),
    platform: process.platform,
    nodeVersion: process.version
  })
})

// GET /list?path=
router.get('/list', (req, res) => {
  try {
    const { path: reqPath, showHidden } = req.query
    const includeHidden = showHidden === 'true'

    let rootPath
    try {
      rootPath = resolvePath(reqPath)
      assertInsideRoot(rootPath, 'list path')
    } catch (err) {
      return res.status(err.status || 400).json({ error: 'Invalid path: ' + err.message })
    }

    let exists = false
    try {
      exists = fs.existsSync(rootPath)
    } catch (_) {}

    if (!exists) {
      return res.status(404).json({ error: 'Directory not found' })
    }

    // Read directory
    let entries = []
    try {
      const dirEntries = fs.readdirSync(rootPath, { withFileTypes: true })
      entries = dirEntries
        .map(entry => {
          const fullPath = path.join(rootPath, entry.name)
          const displayPath = buildDisplayPath(reqPath, entry.name)

          if (!includeHidden && entry.name.startsWith('.')) {
            return null
          }

          try {
            // Use lstatSync to check if it's a directory/symlink junction, then follow with statSync
            let stats
            let isDir = entry.isDirectory()

            // If not a directory but is a symlink, check what it points to
            if (!isDir && entry.isSymbolicLink()) {
              try {
                stats = fs.statSync(fullPath)  // follows the symlink
                isDir = stats.isDirectory()
              } catch {
                stats = fs.lstatSync(fullPath)
              }
            } else {
              stats = fs.statSync(fullPath)
              if (!isDir) {
                isDir = stats.isDirectory()
              }
            }

            if (entry.isSymbolicLink() && !isDir && !includeHidden) {
              return null
            }

            // Windows compatibility junctions like Documents/My Videos often
            // stat as directories but cannot be scanned. Hide them from the
            // normal view so the client does not navigate into a guaranteed 400.
            if (isDir && entry.isSymbolicLink() && !includeHidden) {
              try {
                fs.readdirSync(fullPath, { withFileTypes: true })
              } catch {
                return null
              }
            }

            return {
              name: entry.name,
              path: displayPath,
              type: isDir ? 'directory' : 'file',
              size: stats.size,
              modified: stats.mtime.toISOString(),
              extension: stats.isFile() ? path.extname(entry.name).toLowerCase() : null
            }
          } catch (err) {
            if (entry.isSymbolicLink() && !includeHidden) {
              return null
            }

            // Fallback for inaccessible files
            return {
              name: entry.name,
              path: displayPath,
              type: entry.isDirectory() ? 'directory' : 'file',
              size: 0,
              modified: new Date().toISOString(),
              extension: entry.isFile() ? path.extname(entry.name).toLowerCase() : null,
              error: err.code
            }
          }
        })
        .filter(Boolean)
    } catch (readErr) {
      const status = ['EACCES', 'EPERM'].includes(readErr.code) ? 403 : 400
      return res.status(status).json({ error: 'Cannot read directory: ' + readErr.message })
    }

    res.json({ path: reqPath || '/', children: entries })
  } catch (err) {
    sendErr(res, err)
  }
})

// GET /read?path=
router.get('/read', (req, res) => {
  try {
    const { path: reqPath } = req.query
    const fullPath = resolvePath(reqPath)
    assertInsideRoot(fullPath, 'read path')

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const stats = fs.statSync(fullPath)
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot read directory' })
    }

    // Check file type
    const ext = path.extname(fullPath).toLowerCase()
    const allowedExts = ['.txt', '.md', '.json', '.js', '.py', '.html', '.css', '.xml', '.yaml', '.yml', '.ts', '.tsx', '.jsx']

    if (!allowedExts.includes(ext)) {
      return res.status(415).json({ error: `Unsupported file type: ${ext}` })
    }

    const content = fs.readFileSync(fullPath, 'utf-8')
    res.json({
      content,
      lines: content.split('\n').length,
      size: stats.size,
      encoding: 'utf-8'
    })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// POST /create
router.post('/create', scopePermissions, (req, res) => {
  try {
    const { path: reqPath, name, type, content } = createSchema.parse(req.body)
    const parentPath = resolvePath(reqPath || '/')
    const fullPath = path.join(parentPath, name)

    // Security check — must stay inside FS_ROOT
    assertInsideRoot(fullPath, 'create path')

    if (type === 'directory') {
      fs.mkdirSync(fullPath, { recursive: true })
    } else {
      fs.writeFileSync(fullPath, content || '')
    }

    // Auto-trigger workflow rules
    try {
      const trigger = type === 'directory' ? 'directory_create' : 'file_create'
      runRules(trigger, { name, parentPath: reqPath || '/' }, DEMO_FS_ROOT)
    } catch (wfErr) {
      console.warn('[Workflow] trigger failed:', wfErr.message)
    }

    res.json({ success: true, path: path.join(reqPath || '/', name), type })

    // FIX 1 — fire-and-forget: audit log (non-blocking)
    prisma.fileActivity.create({
      data: { path: fullPath, action: 'create', userName: req.session?.userName || 'anonymous' }
    }).catch(e => console.warn('[FileActivity] create log failed:', e.message))

  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors })
    }
    res.status(400).json({ error: err.message })
  }
})

// PUT /write - Save/update file contents
router.put('/write', scopePermissions, (req, res) => {
  try {
    const { path: reqPath, content } = writeSchema.parse(req.body)
    const fullPath = resolvePath(reqPath)

    // Security check — must stay inside FS_ROOT
    assertInsideRoot(fullPath, 'write path')

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const stats = fs.statSync(fullPath)
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot write to a directory' })
    }

    fs.writeFileSync(fullPath, content, 'utf-8')

    const newStats = fs.statSync(fullPath)
    res.json({
      success: true,
      path: reqPath,
      size: newStats.size,
      modified: newStats.mtime.toISOString()
    })

    // FIX 1 — fire-and-forget: audit log (non-blocking)
    prisma.fileActivity.create({
      data: { path: fullPath, action: 'write', userName: req.session?.userName || 'anonymous' }
    }).catch(e => console.warn('[FileActivity] write log failed:', e.message))

  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors })
    }
    res.status(400).json({ error: err.message })
  }
})

// POST /move - Move/copy files between directories
router.post('/move', scopePermissions, (req, res) => {
  try {
    const { sourcePath, destPath } = moveSchema.parse(req.body)
    const fullSource = resolvePath(sourcePath)
    const fullDest = resolvePath(destPath)

    // Security checks — both paths must be inside FS_ROOT
    assertInsideRoot(fullSource, 'move source')
    assertInsideRoot(fullDest,   'move destination')
    if (!fs.existsSync(fullSource)) {
      return res.status(404).json({ error: 'Source not found' })
    }

    // Ensure dest directory exists
    const destDir = path.dirname(fullDest)
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }

    fs.renameSync(fullSource, fullDest)

    const relativeDest = path.relative(DEMO_FS_ROOT, fullDest)
    res.json({ success: true, newPath: '/' + relativeDest.replace(/\\/g, '/') })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors })
    }
    res.status(400).json({ error: err.message })
  }
})

// ── Trash helpers ─────────────────────────────────────────────────────────────
const TRASH_DIR   = path.join(FS_ROOT, '.spiritos-trash')
const TRASH_INDEX = path.join(TRASH_DIR, '.index.json')

function ensureTrashDir() {
  if (!fs.existsSync(TRASH_DIR)) fs.mkdirSync(TRASH_DIR, { recursive: true })
}

function readTrashIndex() {
  ensureTrashDir()
  try { return JSON.parse(fs.readFileSync(TRASH_INDEX, 'utf-8')) }
  catch (_) { return [] }
}

function writeTrashIndex(records) {
  ensureTrashDir()
  fs.writeFileSync(TRASH_INDEX, JSON.stringify(records, null, 2), 'utf-8')
}

// DELETE /delete — move to Trash (non-destructive)
router.delete('/delete', scopePermissions, (req, res) => {
  try {
    const { path: reqPath } = deleteSchema.parse(req.body)
    const fullPath = resolvePath(reqPath)

    assertInsideRoot(fullPath, 'delete path')

    // Never allow trashing the trash folder itself
    if (path.resolve(fullPath) === path.resolve(TRASH_DIR)) {
      return res.status(400).json({ error: 'Cannot delete the Trash folder' })
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Path not found' })
    }

    const stats    = fs.statSync(fullPath)
    const basename = path.basename(fullPath)
    const id       = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const trashedName = `${Date.now()}__${basename}`
    const trashDest   = path.join(TRASH_DIR, trashedName)

    ensureTrashDir()
    fs.renameSync(fullPath, trashDest)

    // Record in index
    const records = readTrashIndex()
    records.unshift({
      id,
      originalPath: reqPath,          // client-relative path for display
      originalFull: fullPath,         // absolute for restore
      trashedName,
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.isDirectory() ? 0 : stats.size,
      deletedAt: new Date().toISOString()
    })
    writeTrashIndex(records)

    res.json({ success: true, id, message: `Moved "${basename}" to Trash` })

    // Audit log (non-blocking)
    prisma.fileActivity.create({
      data: { path: fullPath, action: 'delete', userName: req.session?.userName || 'anonymous' }
    }).catch(e => console.warn('[FileActivity] delete log failed:', e.message))

  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request' })
    }
    sendErr(res, err)
  }
})

// GET /trash — list trashed items (most recent first)
router.get('/trash', (req, res) => {
  try {
    const records = readTrashIndex()
    res.json({ items: records })
  } catch (err) {
    sendErr(res, err)
  }
})

// POST /trash/restore — restore one item by id
router.post('/trash/restore', scopePermissions, (req, res) => {
  try {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id is required' })

    const records    = readTrashIndex()
    const idx        = records.findIndex(r => r.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Trash item not found' })

    const record     = records[idx]
    const trashSrc   = path.join(TRASH_DIR, record.trashedName)

    if (!fs.existsSync(trashSrc)) {
      // Item already gone — clean up the record
      records.splice(idx, 1)
      writeTrashIndex(records)
      return res.status(404).json({ error: 'Trash file is missing from disk' })
    }

    // Resolve restore destination
    let restoreDest = record.originalFull
    let restoredTo  = record.originalPath

    // If original parent no longer exists, restore to FS_ROOT
    if (!fs.existsSync(path.dirname(restoreDest))) {
      restoreDest = path.join(FS_ROOT, path.basename(restoreDest))
      restoredTo  = '/' + path.basename(restoreDest)
    }

    // Containment check on destination
    assertInsideRoot(restoreDest, 'restore destination')

    // Avoid overwriting an existing file at the destination
    if (fs.existsSync(restoreDest)) {
      const ext    = path.extname(restoreDest)
      const base   = path.basename(restoreDest, ext)
      const dir    = path.dirname(restoreDest)
      restoreDest  = path.join(dir, `${base} (restored)${ext}`)
      restoredTo   = '/' + path.relative(FS_ROOT, restoreDest).replace(/\\/g, '/')
    }

    fs.renameSync(trashSrc, restoreDest)

    records.splice(idx, 1)
    writeTrashIndex(records)

    res.json({ success: true, restoredTo })
  } catch (err) {
    sendErr(res, err)
  }
})

// POST /trash/delete — permanently delete one trash item by id
router.post('/trash/delete', scopePermissions, (req, res) => {
  try {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id is required' })

    const records = readTrashIndex()
    const idx     = records.findIndex(r => r.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Trash item not found' })

    const record  = records[idx]
    const trashSrc = path.join(TRASH_DIR, record.trashedName)

    if (fs.existsSync(trashSrc)) {
      const s = fs.statSync(trashSrc)
      if (s.isDirectory()) fs.rmSync(trashSrc, { recursive: true, force: true })
      else                  fs.unlinkSync(trashSrc)
    }

    records.splice(idx, 1)
    writeTrashIndex(records)

    res.json({ success: true })
  } catch (err) {
    sendErr(res, err)
  }
})

// POST /trash/empty — permanently delete all trash items
router.post('/trash/empty', scopePermissions, (req, res) => {
  try {
    const records = readTrashIndex()
    for (const record of records) {
      const trashSrc = path.join(TRASH_DIR, record.trashedName)
      if (fs.existsSync(trashSrc)) {
        try {
          const s = fs.statSync(trashSrc)
          if (s.isDirectory()) fs.rmSync(trashSrc, { recursive: true, force: true })
          else                  fs.unlinkSync(trashSrc)
        } catch (_) { /* skip inaccessible items */ }
      }
    }
    writeTrashIndex([])
    res.json({ success: true, emptied: records.length })
  } catch (err) {
    sendErr(res, err)
  }
})

// POST /rename
router.post('/rename', scopePermissions, (req, res) => {
  try {
    const { oldPath, newName } = renameSchema.parse(req.body)
    const fullPath = resolvePath(oldPath)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Path not found' })
    }

    const dir = path.dirname(fullPath)
    const newPath = path.join(dir, newName)

    // FIX 4: strict path-traversal check — must be inside FS_ROOT (not just startsWith)
    const resolvedNew  = path.resolve(newPath)
    const resolvedRoot = path.resolve(FS_ROOT)
    if (!resolvedNew.startsWith(resolvedRoot + path.sep) && resolvedNew !== resolvedRoot) {
      return res.status(403).json({ error: 'Destination outside FS_ROOT' })
    }

    fs.renameSync(fullPath, newPath)

    const relativePath = path.relative(DEMO_FS_ROOT, newPath)
    res.json({ success: true, oldPath, newPath: '/' + relativePath.replace(/\\/g, '/') })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors })
    }
    res.status(400).json({ error: err.message })
  }
})

// POST /copy — Copy a file or directory
router.post('/copy', scopePermissions, (req, res) => {
  try {
    const { sourcePath, destPath } = moveSchema.parse(req.body)
    const fullSource = resolvePath(sourcePath)
    const fullDest = resolvePath(destPath)

    if (!fs.existsSync(fullSource)) {
      return res.status(404).json({ error: 'Source not found' })
    }

    // Path traversal check
    const resolvedDest = path.resolve(fullDest)
    const resolvedRoot = path.resolve(FS_ROOT)
    if (!resolvedDest.startsWith(resolvedRoot + path.sep) && resolvedDest !== resolvedRoot) {
      return res.status(403).json({ error: 'Destination outside FS_ROOT' })
    }

    // Avoid overwriting
    if (fs.existsSync(fullDest)) {
      const ext = path.extname(fullDest)
      const base = path.basename(fullDest, ext)
      const dir = path.dirname(fullDest)
      let counter = 1
      let newDest = path.join(dir, `${base} (${counter})${ext}`)
      while (fs.existsSync(newDest)) {
        counter++
        newDest = path.join(dir, `${base} (${counter})${ext}`)
      }
      fs.cpSync(fullSource, newDest, { recursive: true })
      const relativePath = path.relative(DEMO_FS_ROOT, newDest)
      return res.json({ success: true, newPath: '/' + relativePath.replace(/\\/g, '/') })
    }

    fs.cpSync(fullSource, fullDest, { recursive: true })
    const relativePath = path.relative(DEMO_FS_ROOT, fullDest)
    res.json({ success: true, newPath: '/' + relativePath.replace(/\\/g, '/') })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors })
    }
    res.status(400).json({ error: err.message })
  }
})

// GET /search?query=&path=
router.get('/search', (req, res) => {
  try {
    const { query, path: reqPath } = req.query
    if (!query || !query.trim()) {
      return res.json({ query: '', results: [] })
    }

    const searchRoot = resolvePath(reqPath || '/')
    assertInsideRoot(searchRoot, 'search path')
    const lowerQuery = query.toLowerCase()
    const results = []
    const MAX_DEPTH = 5
    const MAX_RESULTS = 100

    // Recursive search scoped to the requested directory
    function walkDir(dir, depth) {
      if (depth > MAX_DEPTH || results.length >= MAX_RESULTS) return
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (results.length >= MAX_RESULTS) break
          // Skip hidden/system
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

          const fullPath = path.join(dir, entry.name)
          const relativePath = '/' + path.relative(FS_ROOT, fullPath).replace(/\\/g, '/')

          if (entry.name.toLowerCase().includes(lowerQuery)) {
            try {
              const stat = fs.statSync(fullPath)
              results.push({
                name: entry.name,
                path: relativePath,
                type: entry.isDirectory() ? 'directory' : 'file',
                size: entry.isDirectory() ? 0 : stat.size,
                modified: stat.mtime.toISOString(),
                extension: entry.isDirectory() ? null : path.extname(entry.name).toLowerCase()
              })
            } catch { /* skip inaccessible */ }
          }

          if (entry.isDirectory()) {
            walkDir(fullPath, depth + 1)
          }
        }
      } catch { /* skip inaccessible directories */ }
    }

    walkDir(searchRoot, 0)
    res.json({ query, results })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// GET /view?path= — Serve raw files (images, PDFs, videos, etc.)
router.get('/view', (req, res) => {
  try {
    const { path: reqPath } = req.query
    if (!reqPath) return res.status(400).json({ error: 'path is required' })

    const fullPath = resolvePath(reqPath)

    // Always enforce FS_ROOT containment — drive paths are only allowed
    // if they are inside FS_ROOT (e.g. FS_ROOT is itself a drive root).
    assertInsideRoot(fullPath, 'view path')

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Cannot serve a directory' })
    }

    res.sendFile(fullPath)
  } catch (err) {
    sendErr(res, err)
  }
})

// GET /stats?path=
router.get('/stats', (req, res) => {
  try {
    const { path: reqPath } = req.query
    const rootPath = resolvePath(reqPath || '/')
    assertInsideRoot(rootPath, 'stats path')
    const tree = dfsTraverse(rootPath)
    const stats = getStats(tree)

    res.json(stats)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

module.exports = router

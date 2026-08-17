/**
 * server/lib/docParser.js — Phase 3.4
 *
 * Document parsers for feeding content into vector search:
 *   - PDF  → text via pdf-parse
 *   - DOCX → text via mammoth
 *   - HTML → text via cheerio (already installed)
 *   - TXT/MD → raw text (no extra dep)
 *
 * Falls back gracefully if optional deps are missing.
 */

const fs   = require('fs')
const path = require('path')
const _process = require('process')

// ── Safe path resolver ────────────────────────────────────────────────────────

function safePath(userPath) {
  const root = _process.env.FS_ROOT || require('os').homedir()
  const resolved = path.resolve(root, userPath || '')
  if (!resolved.startsWith(root)) throw new Error('Path traversal blocked')
  return resolved
}

// ── Individual parsers ────────────────────────────────────────────────────────

async function parsePdf(filePath) {
  let pdfParse
  try {
    pdfParse = require('pdf-parse')
  } catch (_) {
    throw new Error('pdf-parse not installed. Run: npm install pdf-parse --save')
  }
  const buffer = fs.readFileSync(filePath)
  const data = await pdfParse(buffer)
  return {
    text:     data.text.trim(),
    pages:    data.numpages,
    info:     data.info || {},
    mimeType: 'application/pdf'
  }
}

async function parseDocx(filePath) {
  let mammoth
  try {
    mammoth = require('mammoth')
  } catch (_) {
    throw new Error('mammoth not installed. Run: npm install mammoth --save')
  }
  const result = await mammoth.extractRawText({ path: filePath })
  return {
    text:     result.value.trim(),
    warnings: result.messages || [],
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
}

function parseHtml(filePath) {
  const cheerio = require('cheerio')
  const raw = fs.readFileSync(filePath, 'utf-8')
  const $ = cheerio.load(raw)
  // Remove scripts, styles, nav, footer
  $('script, style, nav, footer, header, noscript').remove()
  const text = $('body').text().replace(/\s+/g, ' ').trim()
  const title = $('title').text().trim()
  return {
    text,
    title,
    mimeType: 'text/html'
  }
}

function parsePlainText(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  return {
    text:     content.trim(),
    mimeType: 'text/plain'
  }
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

/**
 * Parse a document and return its text content.
 * @param {string} userPath - Path relative to FS_ROOT
 * @returns {{ text, mimeType, pages?, title?, warnings? }}
 */
async function parseDocument(userPath) {
  const filePath = safePath(userPath)

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${userPath}`)
  }

  const stat = fs.statSync(filePath)
  if (stat.size > 10 * 1024 * 1024) {
    throw new Error('File too large (>10 MB)')
  }

  const ext = path.extname(filePath).toLowerCase()

  switch (ext) {
    case '.pdf':
      return await parsePdf(filePath)
    case '.docx':
    case '.doc':
      return await parseDocx(filePath)
    case '.html':
    case '.htm':
      return parseHtml(filePath)
    case '.txt':
    case '.md':
    case '.csv':
    case '.json':
    case '.xml':
    case '.yaml':
    case '.yml':
    case '.js':
    case '.ts':
    case '.jsx':
    case '.tsx':
    case '.py':
    case '.css':
      return parsePlainText(filePath)
    default:
      throw new Error(`Unsupported file type: ${ext}`)
  }
}

/**
 * Check which optional parsers are available.
 */
function getParserStatus() {
  const status = { html: true, plainText: true }
  try { require('pdf-parse'); status.pdf = true } catch (_) { status.pdf = false }
  try { require('mammoth');   status.docx = true } catch (_) { status.docx = false }
  return status
}

module.exports = { parseDocument, getParserStatus, parsePdf, parseDocx, parseHtml, parsePlainText }

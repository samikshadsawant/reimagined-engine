/**
 * server/lib/visionOcr.js — Phase 3.3
 *
 * Vision and OCR capabilities:
 *   - capture_screen: screenshot-desktop → base64 PNG
 *   - ocr_image: tesseract.js → extracted text from image file or base64
 *   - analyze_image: Gemini Vision → describe/analyze an image
 *
 * All three are exposed as IRIS tool handlers and also as standalone
 * functions for use by the vector search indexer (Phase 3.4).
 */

const fs   = require('fs')
const path = require('path')
const _process = require('process')

// ── Screen Capture ────────────────────────────────────────────────────────────

/**
 * Capture the current screen as a base64 PNG.
 * Uses screenshot-desktop (already installed).
 * @returns {{ base64: string, width?: number, height?: number, savedPath?: string }}
 */
async function captureScreen({ save_to_file = false } = {}) {
  let screenshot
  try {
    screenshot = require('screenshot-desktop')
  } catch (_) {
    throw new Error('screenshot-desktop is not installed. Run: npm install screenshot-desktop')
  }

  const imgBuffer = await screenshot({ format: 'png' })
  const base64 = imgBuffer.toString('base64')

  let savedPath = null
  if (save_to_file) {
    const screenshotsDir = path.join(_process.env.FS_ROOT || require('os').homedir(), 'SpiritOS Screenshots')
    fs.mkdirSync(screenshotsDir, { recursive: true })
    const filename = `screenshot_${Date.now()}.png`
    savedPath = path.join(screenshotsDir, filename)
    fs.writeFileSync(savedPath, imgBuffer)
  }

  return {
    base64,
    mimeType: 'image/png',
    size: imgBuffer.length,
    savedPath
  }
}

// ── OCR ───────────────────────────────────────────────────────────────────────

/**
 * Extract text from an image using Tesseract.js.
 * @param {Object} opts
 * @param {string} [opts.file_path] - Path to image file (relative to FS_ROOT)
 * @param {string} [opts.base64]    - Base64-encoded image data
 * @param {string} [opts.lang]      - Tesseract language code (default 'eng')
 * @returns {{ text: string, confidence: number }}
 */
async function ocrImage({ file_path, base64, lang = 'eng' } = {}) {
  let Tesseract
  try {
    Tesseract = require('tesseract.js')
  } catch (_) {
    throw new Error('tesseract.js is not installed. Run: npm install tesseract.js')
  }

  let imageSource
  if (file_path) {
    const root = _process.env.FS_ROOT || require('os').homedir()
    const resolved = path.resolve(root, file_path)
    if (!resolved.startsWith(root)) throw new Error('Path traversal blocked')
    if (!fs.existsSync(resolved)) throw new Error(`File not found: ${file_path}`)
    imageSource = resolved
  } else if (base64) {
    // Convert base64 to Buffer for Tesseract
    imageSource = Buffer.from(base64, 'base64')
  } else {
    throw new Error('Must provide file_path or base64')
  }

  const { data } = await Tesseract.recognize(imageSource, lang, {
    logger: () => {} // suppress progress logs
  })

  return {
    text:       data.text.trim(),
    confidence: Math.round(data.confidence),
    words:      data.words?.length || 0
  }
}

// ── Gemini Vision ─────────────────────────────────────────────────────────────

/**
 * Analyze an image using Gemini Vision.
 * @param {Object} opts
 * @param {string} [opts.file_path]  - Path to image file (relative to FS_ROOT)
 * @param {string} [opts.base64]     - Base64-encoded image data
 * @param {string} [opts.mime_type]  - MIME type (default 'image/png')
 * @param {string} [opts.prompt]     - What to ask about the image
 * @returns {{ description: string, model: string }}
 */
async function analyzeImage({ file_path, base64, mime_type = 'image/png', prompt } = {}) {
  const apiKey = _process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  let imageBase64 = base64
  if (file_path && !imageBase64) {
    const root = _process.env.FS_ROOT || require('os').homedir()
    const resolved = path.resolve(root, file_path)
    if (!resolved.startsWith(root)) throw new Error('Path traversal blocked')
    if (!fs.existsSync(resolved)) throw new Error(`File not found: ${file_path}`)
    imageBase64 = fs.readFileSync(resolved).toString('base64')

    // Detect MIME type from extension
    const ext = path.extname(file_path).toLowerCase()
    const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' }
    mime_type = mimeMap[ext] || 'image/png'
  }

  if (!imageBase64) throw new Error('Must provide file_path or base64')

  const userPrompt = prompt || 'Describe this image in detail. If it contains text, extract it. If it shows a screen or UI, describe what is visible.'

  const { GoogleGenerativeAI } = require('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const result = await model.generateContent([
    userPrompt,
    {
      inlineData: {
        mimeType: mime_type,
        data: imageBase64
      }
    }
  ])

  return {
    description: result.response.text(),
    model: 'gemini-2.0-flash'
  }
}

/**
 * Capture screen and immediately analyze it with Gemini Vision.
 * Convenience wrapper combining captureScreen + analyzeImage.
 * @param {string} [prompt] - What to look for on screen
 * @returns {{ description: string, base64: string }}
 */
async function captureAndAnalyze({ prompt } = {}) {
  const captured = await captureScreen()
  const analysis = await analyzeImage({
    base64: captured.base64,
    mime_type: 'image/png',
    prompt: prompt || 'Describe what is currently visible on the screen. List any open applications, text content, and UI elements.'
  })
  return {
    description: analysis.description,
    base64: captured.base64,
    size: captured.size
  }
}

module.exports = {
  captureScreen,
  ocrImage,
  analyzeImage,
  captureAndAnalyze
}

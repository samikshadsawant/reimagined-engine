/**
 * server/routes/upload.js — FIX H1
 *
 * Handles multipart file uploads for the KnownBook photo feature.
 * Mounted at /api/upload in server/index.js.
 *
 * POST /api/upload
 *   Body: multipart/form-data with field "photo"
 *   Returns: { url, filename, size }
 */

const express = require('express')
const router  = express.Router()
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
const { requireAuth } = require('../middleware/auth')  // FIX 1

// Ensure uploads directory exists
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads')
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file,  cb) => {
    const ext    = path.extname(file.originalname).toLowerCase()
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`
    cb(null, unique)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },   // 10 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error(`File type ${ext} is not allowed`))
  }
})

// POST /api/upload — FIX 1: requires authentication
router.post('/', requireAuth, upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }
  res.json({
    url:      `/uploads/${req.file.filename}`,
    filename: req.file.filename,
    size:     req.file.size
  })
})

// Error handler for multer
// eslint-disable-next-line no-unused-vars
router.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message })
})

module.exports = router

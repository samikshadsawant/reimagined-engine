const express = require('express')
const multer = require('multer')
const rateLimit = require('express-rate-limit')
const { z } = require('zod')
const { config, getStatus, languageChoices } = require('../lib/gnani/config')
const gnani = require('../lib/gnani')

const router = express.Router()
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many voice requests. Please try again shortly.' } }
})
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.stt.maxUploadBytes, files: 1 }
})

function receiveAudio(req, res, next) {
  upload.single('audio')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
      return res.status(status).json({
        error: {
          code: error.code,
          message: status === 413 ? 'Audio file exceeds the configured upload limit.' : 'Invalid audio upload.'
        }
      })
    }
    next(error)
  })
}

const ttsSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  language: z.string().min(2).max(12),
  speed: z.number().min(0.85).max(1.15).optional()
}).strict()

router.get('/status', (req, res) => {
  res.json(getStatus())
})

router.post('/stt', limiter, receiveAudio, async (req, res, next) => {
  const controller = new AbortController()
  req.once('aborted', () => controller.abort())
  res.once('close', () => {
    if (!res.writableEnded) controller.abort()
  })
  try {
    if (!req.file) {
      return res.status(400).json({
        error: { code: 'AUDIO_REQUIRED', message: 'Provide an audio file in the "audio" field.' }
      })
    }
    const result = await gnani.transcribe({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      language: req.body.language,
      signal: controller.signal
    })
    res.json(result)
  } catch (error) {
    if (req.aborted || res.destroyed) return
    if (error instanceof gnani.GnaniError) {
      return res.status(error.statusCode).json({
        error: { code: error.code, message: error.message }
      })
    }
    next(error)
  }
})

router.post('/tts', limiter, async (req, res, next) => {
  const parsed = ttsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Provide text (1–5000 characters), a supported language, and optional speed (0.85–1.15).'
      }
    })
  }

  const controller = new AbortController()
  req.once('aborted', () => controller.abort())
  res.once('close', () => {
    if (!res.writableEnded) controller.abort()
  })
  try {
    const choice = languageChoices.find((language) => language.id === parsed.data.language)
    if (!choice) {
      return res.status(400).json({
        error: { code: 'UNSUPPORTED_LANGUAGE', message: 'Choose a supported TTS language.' }
      })
    }
    const result = await gnani.synthesize({
      ...parsed.data,
      language: choice.ttsCode,
      signal: controller.signal
    })
    res.set('Content-Type', result.contentType)
    res.set('Cache-Control', 'no-store')
    res.send(result.audio)
  } catch (error) {
    if (req.aborted || res.destroyed) return
    if (error instanceof gnani.GnaniError) {
      return res.status(error.statusCode).json({
        error: { code: error.code, message: error.message }
      })
    }
    next(error)
  }
})

module.exports = router

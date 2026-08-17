/**
 * SavitaOS Server Entry Point
 */

const express = require('express')
const cors = require('cors')
const session = require('express-session')
const http = require('http')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '.env'), override: true })

// Import routes
const fsRoutes           = require('./routes/fs')
const agentRoutes        = require('./routes/agent')
const profileRoutes      = require('./routes/profile')
const authRoutes         = require('./routes/auth')
const terminalRoutes     = require('./routes/terminal')
const knownBookRoutes    = require('./routes/knownBook')    // Phase 2.2
const uploadRoutes       = require('./routes/upload')
const logRoutes          = require('./routes/log')           // Client terminal logger
const presentationRoutes = require('./routes/presentations') // Slide-show app
const reminderRoutes     = require('./routes/reminders')     // Meds + appointments
const emergencyRoutes    = require('./routes/emergency')     // SOS contacts
const memoryRoutes       = require('./routes/memory')        // Phase 3.1 — Memory API
const searchRoutes       = require('./routes/search')        // Phase 3.2 — Vector search
const automationRoutes   = require('./routes/automation')    // Phase 4.1 — Desktop automation
const vaultRoutes        = require('./routes/vault')         // Phase 4.2 — Biometric vault
const { initWS, cleanupWS } = require('./ws')

// Single shared PrismaClient. Imported here only so we can log a heartbeat
// at boot; route files import from ./lib/prisma directly.
const prisma = require('./lib/prisma')
console.log('✅ Prisma client connected (shared singleton)')

// Create Express app
const app = express()

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Session middleware
app.use(session({
  secret: (() => {                             // FIX 3: no hardcoded fallback
    if (!process.env.SESSION_SECRET)
      throw new Error('SESSION_SECRET env var is required — set it in server/.env')
    return process.env.SESSION_SECRET
  })(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',   // CSRF: blocks cross-origin POST/PUT/DELETE requests
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}))

// ─── Request Logger ───────────────────────────────────────────────────────────
// Logs every incoming request + response status + duration to the terminal
app.use((req, res, next) => {
  const start = Date.now()
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '-'

  res.on('finish', () => {
    const ms = Date.now() - start
    const status = res.statusCode
    const color =
      status >= 500 ? '\x1b[31m' :   // red
      status >= 400 ? '\x1b[33m' :   // yellow
      status >= 300 ? '\x1b[36m' :   // cyan
                      '\x1b[32m'     // green
    const reset = '\x1b[0m'
    console.log(
      `${color}[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl} → ${status} (${ms}ms) [${ip}]${reset}`
    )
  })

  next()
})

// API Routes
app.use('/api/fs',            fsRoutes)
app.use('/api/agent',         agentRoutes)
app.use('/api/profile',       profileRoutes)
app.use('/api/auth',          authRoutes)
app.use('/api/terminal',      terminalRoutes)
app.use('/api/known-book',    knownBookRoutes)
app.use('/api/upload',        uploadRoutes)
app.use('/api/log',           logRoutes)
app.use('/api/presentations', presentationRoutes)
app.use('/api/reminders',     reminderRoutes)
app.use('/api/emergency',     emergencyRoutes)
app.use('/api/memory',        memoryRoutes)        // Phase 3.1
app.use('/api/search',        searchRoutes)        // Phase 3.2
app.use('/api/automation',    automationRoutes)    // Phase 4.1
app.use('/api/vault',         vaultRoutes)         // Phase 4.2
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'))
  })
}

// Create HTTP server
const PORT = process.env.PORT || 3001
const httpServer = http.createServer(app)

// Initialize WebSocket
initWS(httpServer)

// Start server
httpServer.listen(PORT, () => {
  console.log(`SavitaOS backend running on port ${PORT}`)
  console.log(`API: http://localhost:${PORT}/api`)
  console.log(`WebSocket: ws://localhost:${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...')
  // Cleanup WebSocket resources
  cleanupWS()
  // Disconnect Prisma
  if (prisma) {
    await prisma.$disconnect()
    console.log('Prisma client disconnected')
  }
  httpServer.close(() => {
    console.log('HTTP server closed')
    process.exit(0)
  })
})

// Also handle SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
  console.log('Shutting down (SIGINT)...')
  cleanupWS()
  if (prisma) {
    await prisma.$disconnect()
  }
  httpServer.close(() => {
    process.exit(0)
  })
})

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  console.warn(`\x1b[33m[404] ${req.method} ${req.originalUrl} — not found\x1b[0m`)
  res.status(404).json({ error: 'Route not found', path: req.originalUrl })
})

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Must be 4-argument to be recognized as error middleware by Express
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal Server Error'

  console.error('\x1b[31m━━━ ERROR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m')
  console.error(`\x1b[31m  ${req.method} ${req.originalUrl}  →  ${status}\x1b[0m`)
  console.error(`\x1b[31m  Message: ${message}\x1b[0m`)
  if (err.stack) {
    console.error('\x1b[90m' + err.stack.split('\n').slice(1).join('\n') + '\x1b[0m')
  }
  console.error('\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m')

  if (!res.headersSent) {
    res.status(status).json({
      error: message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    })
  }
})

// ─── Process-level crash guards ───────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('\x1b[31m[UNCAUGHT EXCEPTION]\x1b[0m', err.stack || err.message)
})

process.on('unhandledRejection', (reason) => {
  console.error('\x1b[31m[UNHANDLED REJECTION]\x1b[0m', reason?.stack || reason)
})

module.exports = app

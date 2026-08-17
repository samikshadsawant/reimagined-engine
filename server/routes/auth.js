/**
 * Auth Routes
 * Authentication and session management
 *
 * FIX C6: Replaced in-memory Map with Prisma DB (UserProfile model).
 * Users survive server restarts. Passwords hashed with bcryptjs.
 * Session stores req.session.userName (not userId).
 */

const express = require('express')
const router  = express.Router()
const bcrypt  = require('bcryptjs')
const { z }   = require('zod')
const prisma  = require('../lib/prisma')
const { authRateLimiter } = require('../middleware/auth')  // FIX 2

// Validation schemas
const registerSchema = z.object({
  userName: z.string().min(1).max(50),
  password: z.string().min(6).max(100)
})

const loginSchema = z.object({
  userName: z.string().min(1),
  password: z.string().min(1)
})

/**
 * Register a new user
 * POST /api/auth/register
 */
router.post('/register', authRateLimiter, async (req, res) => {  // FIX 2: rate limited
  try {
    const { userName, password } = registerSchema.parse(req.body)

    // Check if user exists in DB
    const existing = await prisma.userProfile.findUnique({ where: { userName } })
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' })
    }

    // Hash password and store in customSettings JSON blob (UserProfile has no password column)
    // We store the hash inside customSettings: { passwordHash: '...' }
    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.userProfile.create({
      data: {
        userName,
        profileName:    'default',
        customSettings: JSON.stringify({ passwordHash })
      }
    })

    req.session.userName = userName
    res.json({ success: true, message: 'User registered successfully', userName })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors })
    }
    console.error('Register error:', err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

/**
 * Login
 * POST /api/auth/login
 */
router.post('/login', authRateLimiter, async (req, res) => {  // FIX 2: rate limited
  try {
    const { userName, password } = loginSchema.parse(req.body)

    // Find user in DB
    const user = await prisma.userProfile.findUnique({ where: { userName } })
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    // Read password hash from customSettings
    let settings = {}
    try {
      settings = JSON.parse(user.customSettings || '{}')
    } catch (err) {
      console.warn('[Auth] Failed to parse customSettings for user:', user.userName, err.message)
    }
    const { passwordHash } = settings

    if (!passwordHash) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    const validPassword = await bcrypt.compare(password, passwordHash)
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    req.session.userName = userName
    res.json({ success: true, message: 'Login successful', userName })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors })
    }
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

/**
 * Logout
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.json({ success: true, message: 'Logged out successfully' })
  })
})

/**
 * Get current session
 * GET /api/auth/me
 */
router.get('/me', (req, res) => {
  if (req.session.userName) {
    res.json({ authenticated: true, userName: req.session.userName })
  } else {
    res.json({ authenticated: false })
  }
})

/**
 * Check if username exists
 * GET /api/auth/check/:userName
 */
router.get('/check/:userName', async (req, res) => {
  const user = await prisma.userProfile.findUnique({ where: { userName: req.params.userName } })
  res.json({ exists: !!user })
})

module.exports = router
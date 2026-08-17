/**
 * Terminal Routes — Sandboxed command execution for SpiritOS Smart Terminal
 *
 * POST /api/terminal/exec  { command: "ipconfig" }
 * Returns: { stdout, stderr, exitCode }
 *
 * Security: Only whitelisted commands are allowed. Dangerous operations
 * (format, del C:\, shutdown, etc.) are blocked.
 */

const express = require('express')
const router = express.Router()
const { exec } = require('child_process')
const { requireAuth } = require('../middleware/auth')  // FIX 1

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function getHeaderHost(value) {
  if (!value) return null
  try {
    return new URL(value).hostname
  } catch {
    return null
  }
}

function isLocalAddress(value) {
  return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1'
}

function isLocalDevRequest(req) {
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.TERMINAL_DEV_ALLOW_UNAUTH === 'false') return false

  const headerHost = getHeaderHost(req.get('origin')) || getHeaderHost(req.get('referer'))
  if (headerHost && !LOCAL_HOSTS.has(headerHost.toLowerCase())) return false
  if (headerHost && LOCAL_HOSTS.has(headerHost.toLowerCase())) return true

  return isLocalAddress(req.ip) || isLocalAddress(req.socket?.remoteAddress)
}

function requireTerminalAuth(req, res, next) {
  if (req.session?.userName) return requireAuth(req, res, next)
  if (isLocalDevRequest(req)) {
    req.user = { userName: process.env.TERMINAL_DEV_USER || 'local-dev' }
    return next()
  }
  return requireAuth(req, res, next)
}

// Maximum output size (prevent memory bombs) - configurable via env
const MAX_OUTPUT = parseInt(process.env.TERMINAL_MAX_OUTPUT) || 50000 // 50KB default

// Execution timeout - configurable via env
const EXEC_TIMEOUT = parseInt(process.env.TERMINAL_TIMEOUT) || 15000 // 15 seconds default

const IS_WINDOWS = process.platform === 'win32'

// ── Blocked patterns (security) ──
const BLOCKED_PATTERNS = [
  /\bformat\b/i,
  /\bdel\s+[a-z]:\\/i,
  /\brd\s+[a-z]:\\/i,
  /\brmdir\s+[a-z]:\\/i,
  /\bshutdown\b/i,
  /\brestart\b/i,
  /\breg\s+(add|delete)\b/i,
  /\bnet\s+(user\s+\w+\s+\/add|localgroup\s+admin)/i,
  /\bpowershell\b/i,
  /\bcmd\s*\/c/i,
  /\bwscript\b/i,
  /\bcscript\b/i,
  /\brm\s+-rf/i,
  /\brm\s+-rf?\s+\//i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bsudo\b/i,
  /\bchmod\s+777\b/i,
  /\b(curl|wget|invoke-webrequest)\b.*\|\s*(cmd|powershell|bash)/i,
  /[;&|`].*\b(del|rm|format|shutdown)\b/i,
  />\s*(con|nul|prn|lpt|com)\b/i,
]

// ── Allowed command prefixes ──
const ALLOWED_COMMANDS = IS_WINDOWS
  ? ['ipconfig','ping','nslookup','tracert','netstat','netsh',
     'systeminfo','hostname','whoami','ver','date','time','echo',
     'dir','type','findstr','find','where','tree',
     'tasklist','taskkill','wmic','net statistics','net user',
     'set','path','cls','more']
  : ['ping','nslookup','traceroute','netstat',
     'hostname','whoami','uname','uptime','date','echo',
     'ls','cat','find','grep','which','tree',
     'ps','top','df','du','free',
     'env','printenv','pwd','id']

/**
 * Check if a command is safe to execute
 */
function isCommandSafe(command) {
  const trimmed = command.trim().toLowerCase()

  // Check blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return { safe: false, reason: 'Command contains a blocked operation' }
    }
  }

  // Extract the base command (first word, or first word before pipe/semicolon/&&)
  // Use exact match against allow-list — NOT startsWith, which lets
  // "setx", "dirwhatever", "netshark" etc. slip through.
  const parts = trimmed.split(/[|&;]/)
  for (const part of parts) {
    const base = part.trim().split(/\s+/)[0]
    if (!base) continue

    const allowed = ALLOWED_COMMANDS.some(cmd => base === cmd.toLowerCase())
    if (!allowed) {
      return { safe: false, reason: `Command "${base}" is not in the allowed list` }
    }
  }

  return { safe: true }
}

/**
 * POST /api/terminal/exec
 * Execute a sandboxed command
 */
router.post('/exec', requireTerminalAuth, (req, res) => {
  const { command } = req.body

  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'Missing command' })
  }

  if (command.length > 500) {
    return res.status(400).json({ error: 'Command too long (max 500 chars)' })
  }

  // Safety check
  const safety = isCommandSafe(command)
  if (!safety.safe) {
    return res.status(403).json({
      error: safety.reason,
      stdout: '',
      stderr: `⛔ Blocked: ${safety.reason}`,
      exitCode: 1
    })
  }

  console.log(`[Terminal] Executing: ${command}`)

  // Execute with platform-aware shell
  const shellOptions = IS_WINDOWS
    ? { shell: 'cmd.exe', windowsHide: true }
    : { shell: '/bin/sh' }

  exec(command, { 
    timeout: EXEC_TIMEOUT, 
    maxBuffer: MAX_OUTPUT, 
    ...shellOptions,
    env: { ...process.env, TERM: 'dumb' } 
  }, (error, stdout, stderr) => {
    // Truncate large outputs
    const out = stdout?.length > MAX_OUTPUT ? stdout.substring(0, MAX_OUTPUT) + '\n... (output truncated)' : stdout || ''
    const err = stderr?.length > MAX_OUTPUT ? stderr.substring(0, MAX_OUTPUT) + '\n... (output truncated)' : stderr || ''

    res.json({
      stdout: out,
      stderr: err,
      exitCode: error ? error.code || 1 : 0
    })
  })
})

/**
 * GET /api/terminal/allowed
 * Return list of allowed commands (for help display)
 */
router.get('/allowed', (req, res) => {
  res.json({ commands: ALLOWED_COMMANDS })
})

module.exports = router

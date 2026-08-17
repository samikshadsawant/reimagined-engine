/**
 * Client-side action logger endpoint
 * Receives log events from the browser and prints them to the server terminal
 */
const router = require('express').Router()

const COLORS = {
  info:  '\x1b[36m',  // cyan
  warn:  '\x1b[33m',  // yellow
  error: '\x1b[31m',  // red
  action:'\x1b[35m',  // magenta
  reset: '\x1b[0m'
}

const ICONS = {
  info:   'ℹ️ ',
  warn:   '⚠️ ',
  error:  '❌',
  action: '🖱️ '
}

router.post('/', (req, res) => {
  const { level = 'info', message, data } = req.body

  if (!message) return res.status(400).json({ error: 'message required' })

  const color = COLORS[level] || COLORS.info
  const icon  = ICONS[level]  || ICONS.info
  const ts    = new Date().toLocaleTimeString()
  const extra = data ? ` ${JSON.stringify(data)}` : ''

  console.log(`${color}[CLIENT ${ts}] ${icon} ${message}${extra}${COLORS.reset}`)

  res.json({ ok: true })
})

module.exports = router

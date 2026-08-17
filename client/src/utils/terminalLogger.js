/**
 * Client-side terminal logger
 * Sends user actions and errors to the server terminal via POST /api/log
 * Usage:
 *   import log from '../utils/terminalLogger'
 *   log.action('Opened app', { app: 'Terminal' })
 *   log.error('Something failed', { reason: err.message })
 */

const API = '/api/log'

async function send(level, message, data) {
  try {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, data })
    })
  } catch {
    // Silently fail — don't let logging break the UI
  }
}

const log = {
  info:   (msg, data) => send('info',   msg, data),
  warn:   (msg, data) => send('warn',   msg, data),
  error:  (msg, data) => send('error',  msg, data),
  action: (msg, data) => send('action', msg, data),
}

export default log

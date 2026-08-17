/**
 * useReminderScheduler
 *
 * Real-time reminder engine that runs at the App level.
 *
 * Features:
 *  - Polls /api/reminders every 30 s, ticks every 10 s.
 *  - Fires both an in-OS notification AND a browser-level Notification
 *    (so reminders surface even when the SpiritOS tab is in the background).
 *  - Speaks the reminder aloud when speakAloud is enabled.
 *  - Plays a short audio cue.
 *  - Supports manual "fire now" via window event 'spiritos:reminder-fire'.
 *  - Supports snooze: window event 'spiritos:reminder-snooze' with detail.id
 *    sets a 10-minute local skip so the same reminder doesn't repeat.
 *  - Tracks lastFiredAt server-side via POST /:id/fire so the next browser
 *    session knows what already happened.
 */

import { useEffect, useRef } from 'react'
import axios from 'axios'
import useOsStore from '../store/osStore'
import { speak } from './useTTS'

const POLL_INTERVAL_MS    = 30_000     // refresh reminder list every 30 s
const TICK_INTERVAL_MS    = 10_000     // check times every 10 s
const SNOOZE_DURATION_MS  = 10 * 60_000

// ── browser notification helpers ──────────────────────────────────────────────
async function ensureNotificationPermission() {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied')  return false
  try {
    const r = await Notification.requestPermission()
    return r === 'granted'
  } catch (_) {
    return false
  }
}

function showBrowserNotification({ title, body }) {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: `spiritos-reminder-${title}`,
      requireInteraction: false,
      silent: false
    })
    // Bring the tab forward when the user clicks the OS notification
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch (err) {
    // Some browsers throw on certain configurations; fall back silently.
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Reminders] browser notification failed:', err.message)
    }
  }
}

// Short, polite chime — fall back to silent if the file fails to load
function playChime() {
  try {
    const a = new Audio('/sounds/Awake.mp3')
    a.volume = 0.5
    a.play().catch(() => {})
  } catch (_) {}
}

export default function useReminderScheduler() {
  const remindersRef = useRef([])
  // Map of id → epoch when snooze expires
  const snoozeUntilRef = useRef(new Map())
  // Map of id → epoch we last fired locally (within this tab)
  const lastLocalFireRef = useRef(new Map())
  const addNotification = useOsStore((s) => s.addNotification)

  useEffect(() => {
    let cancelled = false

    // Ask once for permission. We only ask after the user has the OS open,
    // never on initial boot.
    ensureNotificationPermission().catch(() => {})

    const fetchReminders = async () => {
      try {
        const r = await axios.get('/api/reminders')
        if (!cancelled) remindersRef.current = r.data || []
      } catch (err) {
        // Silent — server may not be reachable right at boot
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Reminders] fetch failed:', err?.message)
        }
      }
    }

    const fireReminder = async (item) => {
      const message = item.title
      const body = item.body || ''
      addNotification(`⏰ ${message}${body ? ' — ' + body : ''}`, 'info')
      if (item.speakAloud) speak(`${message}. ${body}`, { rate: 0.95 })
      playChime()
      showBrowserNotification({
        title: `Reminder: ${message}`,
        body: body || 'It is time.'
      })
      try {
        await axios.post(`/api/reminders/${item.id}/fire`)
        // Update local cache so the UI countdown moves to "tomorrow" right away
        item.lastFiredAt = new Date().toISOString()
      } catch (_) {}
      lastLocalFireRef.current.set(item.id, Date.now())
    }

    const tick = async () => {
      const now = new Date()
      const hh = now.getHours().toString().padStart(2, '0')
      const mm = now.getMinutes().toString().padStart(2, '0')
      const nowKey = `${hh}:${mm}`
      const dayIdx = now.getDay()

      for (const item of remindersRef.current) {
        if (!item.enabled) continue
        if (item.timeOfDay !== nowKey) continue
        if (item.daysMask && item.daysMask[dayIdx] !== '1') continue

        // Skip if this id is currently snoozed
        const snoozeUntil = snoozeUntilRef.current.get(item.id) || 0
        if (snoozeUntil > Date.now()) continue

        // Skip if it already fired this minute (server-side flag OR local mem)
        const localLast = lastLocalFireRef.current.get(item.id) || 0
        if (Date.now() - localLast < 60_000) continue
        if (item.lastFiredAt) {
          const last = new Date(item.lastFiredAt)
          const sameMinute =
            last.getFullYear() === now.getFullYear() &&
            last.getMonth() === now.getMonth() &&
            last.getDate() === now.getDate() &&
            last.getHours() === now.getHours() &&
            last.getMinutes() === now.getMinutes()
          if (sameMinute) continue
        }

        await fireReminder(item)
      }
    }

    // Manual triggers from the UI (Test now, Snooze)
    const onManualFire = (e) => {
      const id = e?.detail?.id
      const item = remindersRef.current.find((r) => r.id === id)
      if (item) fireReminder(item)
    }
    const onSnooze = (e) => {
      const id = e?.detail?.id
      if (!id) return
      const until = Date.now() + SNOOZE_DURATION_MS
      snoozeUntilRef.current.set(id, until)
      addNotification(`💤 Snoozed for 10 minutes`, 'info')
    }

    fetchReminders()
    const refetch = setInterval(fetchReminders, POLL_INTERVAL_MS)
    const ticker  = setInterval(tick, TICK_INTERVAL_MS)
    const initial = setTimeout(tick, 1500)

    window.addEventListener('spiritos:reminder-fire',   onManualFire)
    window.addEventListener('spiritos:reminder-snooze', onSnooze)

    return () => {
      cancelled = true
      clearInterval(refetch)
      clearInterval(ticker)
      clearTimeout(initial)
      window.removeEventListener('spiritos:reminder-fire',   onManualFire)
      window.removeEventListener('spiritos:reminder-snooze', onSnooze)
    }
  }, [addNotification])
}

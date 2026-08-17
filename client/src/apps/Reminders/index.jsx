/**
 * Reminders App
 *
 * Manage daily reminders backed by /api/reminders. The actual scheduler that
 * fires notifications and TTS at the right time lives in useReminderScheduler
 * (hooked into App.jsx) so reminders run regardless of which window is focused.
 *
 * This screen adds:
 *   - Live countdown to the next firing of each reminder.
 *   - "Test now" button that triggers the reminder immediately.
 *   - "Snooze 10 min" suppresses the next firing.
 *   - Browser notification permission banner with one-click enable.
 *
 * Designed for elderly users — large hit targets, plain language, no
 * placeholder data anywhere.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import axios from 'axios'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── helpers ───────────────────────────────────────────────────────────────────
function chipClass(active) {
  return `px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all ${
    active
      ? 'bg-os-accent text-white border-os-accent'
      : 'surface-1 text-fg-mut border border-bd surface-hover'
  }`
}

function fmtTime12h(hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return hhmm
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

/** Build the next Date this reminder will fire, or null if disabled. */
function nextFire(item, now = new Date()) {
  if (!item?.enabled) return null
  const [hh, mm] = (item.timeOfDay || '00:00').split(':').map(Number)
  const mask = item.daysMask || '1111111'
  if (!/[1]/.test(mask)) return null

  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(now)
    candidate.setDate(now.getDate() + offset)
    candidate.setHours(hh, mm, 0, 0)
    if (candidate <= now) continue
    const dow = candidate.getDay()
    if (mask[dow] === '1') return candidate
  }
  return null
}

function fmtCountdown(ms) {
  if (ms == null || ms < 0) return null
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hrs  = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  if (days >= 1)  return `in ${days}d ${hrs}h`
  if (hrs >= 1)   return `in ${hrs}h ${mins}m`
  if (mins >= 1)  return `in ${mins}m`
  return 'in less than a minute'
}

// ── form ──────────────────────────────────────────────────────────────────────
function ReminderForm({ initial, onCancel, onSave, busy }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [body, setBody]   = useState(initial?.body  || '')
  const [time, setTime]   = useState(initial?.timeOfDay || '09:00')
  const [days, setDays]   = useState((initial?.daysMask || '1111111').split(''))
  const [speakLoud, setSpeak] = useState(initial?.speakAloud ?? true)
  const [err, setErr] = useState('')

  const submit = () => {
    if (!title.trim())                  { setErr('Please enter what to remind you about'); return }
    if (!/^\d{2}:\d{2}$/.test(time))    { setErr('Pick a time'); return }
    const daysMask = days.join('')
    if (!/^[01]{7}$/.test(daysMask) || daysMask === '0000000') {
      setErr('Pick at least one day'); return
    }
    setErr('')
    onSave({
      title: title.trim(),
      body:  body.trim() || undefined,
      timeOfDay: time,
      daysMask,
      speakAloud: speakLoud
    })
  }

  const toggleDay = (i) => setDays((d) => d.map((v, idx) => idx === i ? (v === '1' ? '0' : '1') : v))

  return (
    <div className="surface-1 border border-bd rounded-2xl p-5 mb-4">
      <h3 className="font-semibold text-fg mb-3">{initial ? 'Edit reminder' : 'New reminder'}</h3>
      <label className="block text-[12px] text-fg-mut mb-1">What should I remind you about?</label>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Take blood pressure pill"
        maxLength={120}
        className="w-full px-3 py-2 rounded-xl bg-os-bg-primary border border-bd text-fg outline-none focus:border-os-accent mb-3"
      />
      <label className="block text-[12px] text-fg-mut mb-1">Extra details (optional)</label>
      <input
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="e.g. Two tablets with water"
        maxLength={500}
        className="w-full px-3 py-2 rounded-xl bg-os-bg-primary border border-bd text-fg outline-none focus:border-os-accent mb-3"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] text-fg-mut mb-1">Time of day</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-os-bg-primary border border-bd text-fg outline-none focus:border-os-accent"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-[13px] text-fg">
            <input type="checkbox" checked={speakLoud} onChange={(e) => setSpeak(e.target.checked)} className="w-4 h-4" />
            Speak this reminder aloud
          </label>
        </div>
      </div>

      <label className="block text-[12px] text-fg-mut mt-4 mb-2">Repeat on</label>
      <div className="flex flex-wrap gap-2">
        {DAYS.map((d, i) => (
          <button key={d} type="button" className={chipClass(days[i] === '1')} onClick={() => toggleDay(i)}>
            {d}
          </button>
        ))}
      </div>

      {err && <div className="text-red-400 text-[12px] mt-3">{err}</div>}

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel}
          className="px-4 py-2 rounded-xl surface-1 border border-bd text-fg surface-hover">
          Cancel
        </button>
        <button onClick={submit} disabled={busy}
          className="px-4 py-2 rounded-xl bg-os-accent text-white shadow-glow disabled:opacity-50">
          {busy ? 'Saving…' : 'Save reminder'}
        </button>
      </div>
    </div>
  )
}

// ── notification permission banner ───────────────────────────────────────────
function PermissionBanner() {
  const [permission, setPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  )

  if (permission === 'granted' || permission === 'unsupported') return null

  const request = async () => {
    try {
      const r = await Notification.requestPermission()
      setPermission(r)
    } catch (_) {}
  }

  return (
    <div className="rounded-2xl border border-os-accent/30 bg-os-accent/10 p-4 mb-4 flex items-center gap-3">
      <span className="material-symbols-outlined text-[28px] text-os-accent">notifications_active</span>
      <div className="flex-1">
        <p className="font-medium text-fg">
          {permission === 'denied'
            ? 'Notifications are blocked in your browser.'
            : 'Enable notifications so reminders show even when this tab is hidden.'}
        </p>
        <p className="text-[12px] text-fg-mut">
          {permission === 'denied'
            ? 'Open browser site settings and allow notifications for this site.'
            : 'You can revoke this anytime in your browser.'}
        </p>
      </div>
      {permission !== 'denied' && (
        <button onClick={request}
          className="px-3 py-2 rounded-xl bg-os-accent text-white shadow-glow">
          Enable
        </button>
      )}
    </div>
  )
}

// ── main app ──────────────────────────────────────────────────────────────────
export default function Reminders() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  // Tick once a minute so countdowns refresh in real time
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await axios.get('/api/reminders')
      setItems(r.data || [])
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const handleRefresh = () => fetchAll()
    window.addEventListener('spiritos:reminders-changed', handleRefresh)
    return () => window.removeEventListener('spiritos:reminders-changed', handleRefresh)
  }, [fetchAll])

  const save = async (data) => {
    setBusy(true)
    try {
      if (editing) await axios.put(`/api/reminders/${editing.id}`, data)
      else        await axios.post('/api/reminders', data)
      setShowForm(false); setEditing(null)
      await fetchAll()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleEnabled = async (item) => {
    try {
      await axios.put(`/api/reminders/${item.id}`, { enabled: !item.enabled })
      await fetchAll()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    }
  }

  const remove = async (item) => {
    if (!window.confirm(`Delete reminder "${item.title}"?`)) return
    try {
      await axios.delete(`/api/reminders/${item.id}`)
      await fetchAll()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    }
  }

  const fireNow  = (item) => window.dispatchEvent(new CustomEvent('spiritos:reminder-fire',   { detail: { id: item.id } }))
  const snooze   = (item) => window.dispatchEvent(new CustomEvent('spiritos:reminder-snooze', { detail: { id: item.id } }))

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const an = nextFire(a, now)?.getTime() ?? Infinity
      const bn = nextFire(b, now)?.getTime() ?? Infinity
      return an - bn
    })
  }, [items, now])

  return (
    <div className="h-full flex flex-col bg-os-bg-primary">
      <header className="flex items-center justify-between px-6 py-4 border-b border-bd surface-1">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[28px] text-os-accent">alarm</span>
          <div>
            <h1 className="text-xl font-semibold text-fg">Reminders</h1>
            <p className="text-[12px] text-fg-mut">Medications, appointments and daily tasks</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="px-4 py-2 rounded-xl bg-os-accent text-white shadow-glow flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add reminder
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <PermissionBanner />

        {showForm && (
          <ReminderForm
            initial={editing}
            busy={busy}
            onCancel={() => { setShowForm(false); setEditing(null) }}
            onSave={save}
          />
        )}

        {loading ? (
          <div className="text-fg-mut">Loading…</div>
        ) : sorted.length === 0 && !showForm ? (
          <div className="text-center text-fg-mut py-12">
            <span className="material-symbols-outlined text-[48px] opacity-40">notifications_off</span>
            <p className="mt-2">No reminders yet.</p>
            <p className="text-[12px]">Click "Add reminder" to create your first one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((it) => {
              const dayChars = (it.daysMask || '0000000').split('')
              const everyDay = dayChars.every((c) => c === '1')
              const dayLabel = everyDay
                ? 'Every day'
                : DAYS.filter((_, i) => dayChars[i] === '1').join(', ')
              const next = nextFire(it, now)
              const countdown = next ? fmtCountdown(next.getTime() - now.getTime()) : null
              return (
                <div key={it.id}
                     className={`rounded-2xl border surface-1 p-4 flex items-center gap-4 ${
                       it.enabled ? 'border-bd' : 'border-bd opacity-60'
                     }`}>
                  <div className="w-14 h-14 rounded-2xl bg-os-accent/10 border border-os-accent/30
                                  flex items-center justify-center text-os-accent">
                    <span className="material-symbols-outlined text-[28px]">medication</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-fg truncate">{it.title}</h4>
                      <span className="text-fg-mut text-[12px]">·</span>
                      <span className="text-fg font-medium tabular-nums">{fmtTime12h(it.timeOfDay)}</span>
                    </div>
                    {it.body && <p className="text-[12px] text-fg-mut truncate">{it.body}</p>}
                    <p className="text-[11px] text-fg-mut mt-1">
                      {dayLabel}{countdown ? ` · next ${countdown}` : it.enabled ? '' : ' · paused'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button title="Fire this reminder right now (test)"
                      onClick={() => fireNow(it)}
                      className="p-2 rounded-xl surface-hover text-os-accent" disabled={!it.enabled}>
                      <span className="material-symbols-outlined text-[18px]">play_circle</span>
                    </button>
                    <button title="Snooze for 10 minutes"
                      onClick={() => snooze(it)}
                      className="p-2 rounded-xl surface-hover text-fg-mut" disabled={!it.enabled}>
                      <span className="material-symbols-outlined text-[18px]">snooze</span>
                    </button>
                    <label className="flex items-center gap-1 text-[12px] text-fg-mut px-2">
                      <input type="checkbox" checked={it.enabled} onChange={() => toggleEnabled(it)} className="w-4 h-4" />
                      On
                    </label>
                    <button onClick={() => { setEditing(it); setShowForm(true) }}
                      className="p-2 rounded-xl surface-hover text-fg-mut">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onClick={() => remove(it)}
                      className="p-2 rounded-xl hover:bg-red-500/10 text-red-400">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Mail — Quick Compose
 *
 * SpiritOS doesn't run its own mail server, but it can launch the user's
 * default email client via `mailto:`. This screen is intentionally simple —
 * three big inputs and one big "Send" button, designed for elderly users.
 *
 * The "Recent contacts" row pulls from the EmergencyContact list (the same
 * trusted people configured for SOS) so the user can pick a recipient
 * without typing.
 */

import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function Mail() {
  const [to, setTo]           = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody]       = useState('')
  const [contacts, setContacts] = useState([])

  useEffect(() => {
    axios.get('/api/emergency')
      .then((r) => setContacts(r.data || []))
      .catch(() => {})
  }, [])

  const send = () => {
    if (!to.trim()) {
      alert('Please enter an email address.')
      return
    }
    const params = new URLSearchParams()
    if (subject) params.set('subject', subject)
    if (body)    params.set('body', body)
    const qs = params.toString()
    const href = `mailto:${to.trim()}${qs ? '?' + qs : ''}`
    window.location.href = href
  }

  return (
    <div className="h-full flex flex-col bg-os-bg-primary">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-os-border">
        <span className="material-symbols-outlined text-[28px] text-os-accent">mail</span>
        <div>
          <h1 className="text-xl font-semibold text-os-text">Quick Mail</h1>
          <p className="text-[12px] text-os-text-muted">Open your email app pre-filled with a message</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {contacts.length > 0 && (
          <div>
            <label className="block text-[12px] text-os-text-muted mb-2">Pick a contact (or type below)</label>
            <div className="flex flex-wrap gap-2">
              {contacts.map((c) => (
                <button key={c.id}
                  onClick={() => setTo(c.phone.includes('@') ? c.phone : c.notes || '')}
                  className="px-3 py-1.5 rounded-full bg-os-surface border border-os-border text-os-text-muted hover:bg-os-surface-hover text-[12px]">
                  {c.name}{c.relationship ? ` · ${c.relationship}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-[12px] text-os-text-muted mb-1">To</label>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="someone@example.com"
            className="w-full px-3 py-2.5 rounded-xl bg-os-surface border border-os-border text-os-text outline-none focus:border-os-accent text-base" />
        </div>
        <div>
          <label className="block text-[12px] text-os-text-muted mb-1">Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What is this about?"
            className="w-full px-3 py-2.5 rounded-xl bg-os-surface border border-os-border text-os-text outline-none focus:border-os-accent text-base" />
        </div>
        <div>
          <label className="block text-[12px] text-os-text-muted mb-1">Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6}
            placeholder="Write your message…"
            className="w-full px-3 py-2.5 rounded-xl bg-os-surface border border-os-border text-os-text outline-none focus:border-os-accent text-base resize-none" />
        </div>

        <button onClick={send}
          className="w-full mt-2 py-3 rounded-2xl bg-os-accent text-white font-semibold shadow-glow hover:opacity-90 flex items-center justify-center gap-2 text-base">
          <span className="material-symbols-outlined text-[20px]">send</span>
          Send through my email app
        </button>
        <p className="text-[12px] text-os-text-muted text-center pt-1">
          We open your computer's default email program with the message ready.
        </p>
      </div>
    </div>
  )
}

/**
 * Emergency Contacts App
 *
 * Manages contacts for the SOS button shown on the desktop. Stored via
 * /api/emergency. The desktop SOS pill triggers a `tel:` link for the
 * primary contact and a TTS announcement.
 */

import React, { useEffect, useState, useCallback } from 'react'
import axios from 'axios'

function ContactForm({ initial, busy, onCancel, onSave }) {
  const [name, setName] = useState(initial?.name || '')
  const [relationship, setRelationship] = useState(initial?.relationship || '')
  const [phone, setPhone] = useState(initial?.phone || '')
  const [priority, setPriority] = useState(initial?.priority ?? 0)
  const [notes, setNotes] = useState(initial?.notes || '')
  const [err, setErr] = useState('')

  const submit = () => {
    if (!name.trim())  { setErr('Name is required'); return }
    if (!phone.trim()) { setErr('Phone is required'); return }
    if (!/^[\d+\-\s()]+$/.test(phone))
      { setErr('Phone can only contain digits, +, -, spaces and parentheses'); return }
    setErr('')
    onSave({
      name: name.trim(),
      relationship: relationship.trim() || undefined,
      phone: phone.trim(),
      priority: Number(priority) || 0,
      notes: notes.trim() || undefined
    })
  }

  return (
    <div className="surface-1 border border-bd rounded-2xl p-5 mb-4">
      <h3 className="font-semibold text-fg mb-3">{initial ? 'Edit contact' : 'New contact'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[12px] text-fg-mut mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
            className="w-full px-3 py-2 rounded-xl bg-os-bg-primary border border-bd text-fg outline-none focus:border-os-accent" />
        </div>
        <div>
          <label className="block text-[12px] text-fg-mut mb-1">Relationship</label>
          <input value={relationship} onChange={(e) => setRelationship(e.target.value)} maxLength={80}
            placeholder="Son, Doctor, Neighbour…"
            className="w-full px-3 py-2 rounded-xl bg-os-bg-primary border border-bd text-fg outline-none focus:border-os-accent" />
        </div>
        <div>
          <label className="block text-[12px] text-fg-mut mb-1">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} inputMode="tel"
            placeholder="+1 555-0100"
            className="w-full px-3 py-2 rounded-xl bg-os-bg-primary border border-bd text-fg outline-none focus:border-os-accent" />
        </div>
        <div>
          <label className="block text-[12px] text-fg-mut mb-1">Priority (0 = first to call)</label>
          <input type="number" min="0" max="99" value={priority} onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-os-bg-primary border border-bd text-fg outline-none focus:border-os-accent" />
        </div>
      </div>
      <label className="block text-[12px] text-fg-mut mt-3 mb-1">Notes (optional)</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500}
        className="w-full px-3 py-2 rounded-xl bg-os-bg-primary border border-bd text-fg outline-none focus:border-os-accent resize-none" />
      {err && <div className="text-red-400 text-[12px] mt-3">{err}</div>}
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel}
          className="px-4 py-2 rounded-xl surface-1 border border-bd text-fg surface-hover">
          Cancel
        </button>
        <button onClick={submit} disabled={busy}
          className="px-4 py-2 rounded-xl bg-os-accent text-white shadow-glow disabled:opacity-50">
          {busy ? 'Saving…' : 'Save contact'}
        </button>
      </div>
    </div>
  )
}

export default function Emergency() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await axios.get('/api/emergency')
      setItems(r.data || [])
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const save = async (data) => {
    setBusy(true)
    try {
      if (editing) await axios.put(`/api/emergency/${editing.id}`, data)
      else        await axios.post('/api/emergency', data)
      setShowForm(false); setEditing(null)
      await fetchAll()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (item) => {
    if (!window.confirm(`Remove ${item.name} from emergency contacts?`)) return
    try {
      await axios.delete(`/api/emergency/${item.id}`)
      await fetchAll()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    }
  }

  const callContact = (phone) => {
    // tel: links open the OS dialer where supported.
    window.location.href = `tel:${phone.replace(/\s+/g, '')}`
  }

  return (
    <div className="h-full flex flex-col bg-os-bg-primary">
      <header className="flex items-center justify-between px-6 py-4 border-b border-bd surface-1">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[28px] text-red-500">contact_emergency</span>
          <div>
            <h1 className="text-xl font-semibold text-fg">Emergency Contacts</h1>
            <p className="text-[12px] text-fg-mut">The SOS button calls these in order</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="px-4 py-2 rounded-xl bg-os-accent text-white shadow-glow flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add contact
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {showForm && (
          <ContactForm
            initial={editing}
            busy={busy}
            onCancel={() => { setShowForm(false); setEditing(null) }}
            onSave={save}
          />
        )}

        {loading ? (
          <div className="text-fg-mut">Loading…</div>
        ) : items.length === 0 && !showForm ? (
          <div className="text-center text-fg-mut py-12">
            <span className="material-symbols-outlined text-[48px] opacity-40">person_off</span>
            <p className="mt-2">No emergency contacts yet.</p>
            <p className="text-[12px]">Add at least one so the SOS button has someone to call.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((c) => (
              <div key={c.id}
                   className="rounded-2xl border border-bd surface-1 p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20
                                flex items-center justify-center text-red-500">
                  <span className="material-symbols-outlined text-[28px]">support_agent</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-fg truncate">{c.name}</h4>
                    {c.priority === 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 border border-red-500/30 text-red-500">
                        PRIMARY
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-fg-mut">
                    {c.relationship ? `${c.relationship} · ` : ''}{c.phone}
                  </p>
                  {c.notes && <p className="text-[11px] text-fg-mut mt-1 line-clamp-2">{c.notes}</p>}
                </div>
                <button
                  onClick={() => callContact(c.phone)}
                  className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[18px]">call</span>
                  Call
                </button>
                <button onClick={() => { setEditing(c); setShowForm(true) }}
                  className="p-2 rounded-xl surface-hover text-fg-mut">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button onClick={() => remove(c)}
                  className="p-2 rounded-xl hover:bg-red-500/10 text-red-400">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Vault App — Phase 4.2
 *
 * Secure local vault for passwords, PINs, medical info, etc.
 * All data is AES-256-GCM encrypted on the server — the PIN never leaves
 * the browser session (it's sent per-request, never stored).
 *
 * Screens:
 *   1. Lock screen  — PIN entry (setup or unlock)
 *   2. List view    — entries grouped by category, no secrets visible
 *   3. Add form     — add a new entry
 *   4. Detail view  — reveal secret for one entry
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'

const CATEGORIES = ['passwords', 'pins', 'medical', 'insurance', 'financial', 'personal']

const CAT_META = {
  passwords:  { icon: 'key',              color: '#6366f1', label: 'Passwords' },
  pins:       { icon: 'pin',              color: '#f59e0b', label: 'PINs' },
  medical:    { icon: 'medical_services', color: '#ef4444', label: 'Medical' },
  insurance:  { icon: 'shield',           color: '#10b981', label: 'Insurance' },
  financial:  { icon: 'account_balance',  color: '#3b82f6', label: 'Financial' },
  personal:   { icon: 'person',           color: '#8b5cf6', label: 'Personal' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function CatBadge({ category }) {
  const m = CAT_META[category] || CAT_META.personal
  return (
    <span style={{
      background: m.color + '22', color: m.color,
      fontSize: 10, fontWeight: 700, padding: '2px 8px',
      borderRadius: 99, textTransform: 'capitalize', letterSpacing: 0.3
    }}>
      {m.label}
    </span>
  )
}

// ── Lock Screen ───────────────────────────────────────────────────────────────

function LockScreen({ vaultExists, onUnlocked }) {
  const [pin, setPin]       = useState('')
  const [error, setError]   = useState(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (pin.length < 4) return setError('PIN must be at least 4 characters')
    setLoading(true); setError(null)
    try {
      const { data } = await axios.post('/api/vault/unlock', { pin })
      onUnlocked(pin, data)
    } catch (err) {
      setError(err.response?.data?.error || 'Wrong PIN')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center bg-os-bg-primary p-8">
      <div className="w-full max-w-sm">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-3xl bg-os-accent/10 border border-os-accent/30
                          flex items-center justify-center shadow-glow">
            <span className="material-symbols-outlined text-os-accent text-[40px]">lock</span>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-fg text-center mb-1">
          {vaultExists ? 'Unlock Vault' : 'Create Vault'}
        </h2>
        <p className="text-fg-mut text-sm text-center mb-8">
          {vaultExists
            ? 'Enter your PIN to access your secure vault'
            : 'Choose a PIN to protect your vault. This PIN cannot be recovered if lost.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="Enter PIN"
            maxLength={64}
            className="w-full bg-os-bg-primary text-fg border border-bd rounded-xl px-4 py-3
                       text-center text-xl tracking-widest outline-none focus:border-os-accent"
          />

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full py-3 rounded-xl bg-os-accent text-white font-semibold
                       disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {loading ? 'Verifying…' : vaultExists ? 'Unlock' : 'Create Vault'}
          </button>
        </form>

        <p className="text-fg-mut text-xs text-center mt-6">
          🔒 Encrypted with AES-256-GCM · Stored locally · Never sent to any cloud
        </p>
      </div>
    </div>
  )
}

// ── Entry List ────────────────────────────────────────────────────────────────

function EntryList({ entries, onAdd, onSelect, onLock }) {
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? entries : entries.filter(e => e.category === filter)

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(e => e.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  return (
    <div className="h-full flex flex-col bg-os-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-bd">
        <div>
          <h2 className="text-lg font-semibold text-fg">Vault</h2>
          <p className="text-fg-mut text-xs">{entries.length} entries</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onLock}
            className="w-8 h-8 rounded-lg glass-panel flex items-center justify-center
                       text-fg-mut hover:text-fg transition-colors"
            title="Lock vault"
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
          </button>
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-os-accent
                       text-white text-sm font-medium"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 px-5 py-3 overflow-x-auto border-b border-bd">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            filter === 'all' ? 'bg-os-accent text-white' : 'glass-panel text-fg-mut hover:text-fg'
          }`}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === cat ? 'bg-os-accent text-white' : 'glass-panel text-fg-mut hover:text-fg'
            }`}
          >
            {CAT_META[cat].label}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-fg-mut">
            <span className="material-symbols-outlined text-[40px] mb-2">lock_open</span>
            <p className="text-sm">No entries yet. Add your first secret.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[16px]"
                  style={{ color: CAT_META[cat].color }}>{CAT_META[cat].icon}</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-fg-mut">
                  {CAT_META[cat].label}
                </span>
                <span className="text-xs text-fg-mut">({items.length})</span>
              </div>
              <div className="space-y-2">
                {items.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => onSelect(entry)}
                    className="w-full text-left rounded-xl border border-bd surface-1 surface-hover
                               px-4 py-3 flex items-center gap-3 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: CAT_META[cat].color + '22' }}>
                      <span className="material-symbols-outlined text-[18px]"
                        style={{ color: CAT_META[cat].color }}>{CAT_META[cat].icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-fg font-medium text-sm truncate">{entry.label}</p>
                      {entry.notes && (
                        <p className="text-fg-mut text-xs truncate">{entry.notes}</p>
                      )}
                    </div>
                    <span className="material-symbols-outlined text-fg-mut text-[18px]">chevron_right</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Add Form ──────────────────────────────────────────────────────────────────

function AddForm({ pin, onSaved, onCancel }) {
  const [form, setForm] = useState({ category: 'passwords', label: '', secret: '', notes: '' })
  const [showSecret, setShowSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.label.trim()) return setError('Label is required')
    if (!form.secret.trim()) return setError('Secret is required')
    setSaving(true); setError(null)
    try {
      await axios.post('/api/vault/entry', { pin, ...form })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-os-bg-primary">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-bd">
        <button onClick={onCancel} className="w-8 h-8 rounded-lg glass-panel flex items-center justify-center">
          <span className="material-symbols-outlined text-[18px] text-fg-mut">arrow_back</span>
        </button>
        <h2 className="text-lg font-semibold text-fg">Add Secret</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Category */}
        <div>
          <label className="text-xs font-semibold text-fg-mut uppercase tracking-wider block mb-2">Category</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => set('category', cat)}
                className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all flex items-center gap-1.5 ${
                  form.category === cat
                    ? 'border-os-accent bg-os-accent/10 text-os-accent'
                    : 'border-bd surface-1 text-fg-mut hover:text-fg'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{CAT_META[cat].icon}</span>
                {CAT_META[cat].label}
              </button>
            ))}
          </div>
        </div>

        {/* Label */}
        <div>
          <label className="text-xs font-semibold text-fg-mut uppercase tracking-wider block mb-2">Label *</label>
          <input
            value={form.label}
            onChange={e => set('label', e.target.value)}
            placeholder='e.g. "Gmail password" or "Blood type"'
            className="w-full bg-os-bg-primary text-fg border border-bd rounded-xl px-4 py-2.5
                       text-sm outline-none focus:border-os-accent"
            required
          />
        </div>

        {/* Secret */}
        <div>
          <label className="text-xs font-semibold text-fg-mut uppercase tracking-wider block mb-2">Secret *</label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              value={form.secret}
              onChange={e => set('secret', e.target.value)}
              placeholder="The value to store securely"
              className="w-full bg-os-bg-primary text-fg border border-bd rounded-xl px-4 py-2.5
                         text-sm outline-none focus:border-os-accent pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowSecret(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-mut hover:text-fg"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showSecret ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-fg-mut uppercase tracking-wider block mb-2">Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Any extra context…"
            rows={3}
            className="w-full bg-os-bg-primary text-fg border border-bd rounded-xl px-4 py-2.5
                       text-sm outline-none focus:border-os-accent resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl bg-os-accent text-white font-semibold
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save to Vault'}
        </button>
      </form>
    </div>
  )
}

// ── Detail View ───────────────────────────────────────────────────────────────

function EntryDetail({ entry, pin, onBack, onDeleted }) {
  const [secret, setSecret]     = useState(null)
  const [showSecret, setShow]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied]     = useState(false)
  const [error, setError]       = useState(null)

  const reveal = async () => {
    if (secret) { setShow(s => !s); return }
    setLoading(true); setError(null)
    try {
      const { data } = await axios.post('/api/vault/entry/get', { pin, label: entry.label })
      setSecret(data.secret)
      setShow(true)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (_) {}
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${entry.label}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await axios.delete('/api/vault/entry', { data: { pin, label: entry.label } })
      onDeleted()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
      setDeleting(false)
    }
  }

  const m = CAT_META[entry.category] || CAT_META.personal

  return (
    <div className="h-full flex flex-col bg-os-bg-primary">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-bd">
        <button onClick={onBack} className="w-8 h-8 rounded-lg glass-panel flex items-center justify-center">
          <span className="material-symbols-outlined text-[18px] text-fg-mut">arrow_back</span>
        </button>
        <h2 className="text-lg font-semibold text-fg flex-1 truncate">{entry.label}</h2>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400
                     hover:bg-red-500/10 transition-colors"
          title="Delete entry"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Category badge */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: m.color + '22' }}>
            <span className="material-symbols-outlined text-[20px]" style={{ color: m.color }}>{m.icon}</span>
          </div>
          <CatBadge category={entry.category} />
        </div>

        {/* Secret reveal */}
        <div className="rounded-2xl border border-bd surface-1 p-4">
          <p className="text-xs font-semibold text-fg-mut uppercase tracking-wider mb-3">Secret</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 font-mono text-sm text-fg bg-os-bg-primary rounded-lg px-3 py-2 border border-bd min-h-[36px] break-all">
              {showSecret && secret ? secret : '••••••••••••'}
            </div>
            <button
              onClick={reveal}
              disabled={loading}
              className="w-9 h-9 rounded-lg glass-panel flex items-center justify-center text-fg-mut hover:text-fg"
              title={showSecret ? 'Hide' : 'Reveal'}
            >
              <span className="material-symbols-outlined text-[18px]">
                {loading ? 'hourglass_empty' : showSecret ? 'visibility_off' : 'visibility'}
              </span>
            </button>
            {secret && (
              <button
                onClick={copy}
                className="w-9 h-9 rounded-lg glass-panel flex items-center justify-center text-fg-mut hover:text-fg"
                title="Copy to clipboard"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {copied ? 'check' : 'content_copy'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Notes */}
        {entry.notes && (
          <div className="rounded-2xl border border-bd surface-1 p-4">
            <p className="text-xs font-semibold text-fg-mut uppercase tracking-wider mb-2">Notes</p>
            <p className="text-fg text-sm leading-relaxed">{entry.notes}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="rounded-2xl border border-bd surface-1 p-4">
          <p className="text-xs font-semibold text-fg-mut uppercase tracking-wider mb-2">Info</p>
          <p className="text-fg-mut text-xs">Added: {new Date(entry.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function VaultApp() {
  const [vaultExists, setVaultExists] = useState(null)  // null = loading
  const [pin, setPin]                 = useState(null)
  const [entries, setEntries]         = useState([])
  const [view, setView]               = useState('lock') // lock | list | add | detail
  const [selected, setSelected]       = useState(null)

  // Check vault status on mount
  useEffect(() => {
    axios.get('/api/vault/status').then(({ data }) => {
      setVaultExists(data.exists)
    }).catch(() => setVaultExists(false))
  }, [])

  const loadEntries = useCallback(async (currentPin) => {
    try {
      const { data } = await axios.get('/api/vault/entry', {
        headers: { 'x-vault-pin': currentPin }
      })
      setEntries(data.entries || [])
    } catch (_) {
      setEntries([])
    }
  }, [])

  const handleUnlocked = useCallback((unlockedPin, info) => {
    setPin(unlockedPin)
    setVaultExists(true)
    loadEntries(unlockedPin)
    setView('list')
  }, [loadEntries])

  const handleLock = () => {
    setPin(null)
    setEntries([])
    setView('lock')
  }

  const handleSaved = () => {
    loadEntries(pin)
    setView('list')
  }

  const handleDeleted = () => {
    loadEntries(pin)
    setView('list')
  }

  if (vaultExists === null) {
    return (
      <div className="h-full flex items-center justify-center bg-os-bg-primary">
        <span className="text-fg-mut text-sm">Loading vault…</span>
      </div>
    )
  }

  if (view === 'lock' || !pin) {
    return <LockScreen vaultExists={vaultExists} onUnlocked={handleUnlocked} />
  }

  if (view === 'add') {
    return <AddForm pin={pin} onSaved={handleSaved} onCancel={() => setView('list')} />
  }

  if (view === 'detail' && selected) {
    return (
      <EntryDetail
        entry={selected}
        pin={pin}
        onBack={() => setView('list')}
        onDeleted={handleDeleted}
      />
    )
  }

  return (
    <EntryList
      entries={entries}
      onAdd={() => setView('add')}
      onSelect={e => { setSelected(e); setView('detail') }}
      onLock={handleLock}
    />
  )
}

/**
 * Presentation App — accessible slide-show
 *
 * Two screens:
 *   1. Library — list of decks (builtins + your own), Open / New / Delete
 *   2. Player  — full-window slide view with large controls and TTS read-aloud
 *
 * Navigation:
 *   ← / →           previous / next slide
 *   Space, Enter    next slide
 *   R               read current slide aloud
 *   F               toggle auto-advance
 *   Escape          back to library
 *
 * The player also listens for window events from the global voice and
 * gesture controllers so users can navigate hands-free.
 *
 * All data is loaded from /api/presentations — nothing static lives here.
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import useOsStore from '../../store/osStore'
import { speak, cancelSpeech } from '../../hooks/useTTS'

const AUTO_ADVANCE_MS = 8000

// ── small UI helpers ──────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString() } catch { return '' }
}

function BigButton({ onClick, icon, label, primary, disabled, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      className={`px-5 py-3 rounded-2xl flex items-center gap-2 font-semibold transition-all
        ${primary
          ? 'bg-os-accent text-white shadow-glow hover:opacity-90'
          : 'bg-os-surface text-os-text border border-os-border hover:bg-os-surface-hover'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
    >
      {icon && <span className="material-symbols-outlined text-[20px]">{icon}</span>}
      <span>{label}</span>
    </button>
  )
}

// ── Library view ──────────────────────────────────────────────────────────────
function Library({ decks, loading, onOpen, onCreate, onDelete, onRefresh, error }) {
  return (
    <div className="h-full flex flex-col bg-os-bg-primary">
      <header className="flex items-center justify-between px-6 py-4 border-b border-os-border">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[28px] text-os-accent">slideshow</span>
          <div>
            <h1 className="text-xl font-semibold text-os-text">Presentations</h1>
            <p className="text-[12px] text-os-text-muted">Slide decks for guides, lessons and reminders</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BigButton icon="refresh" label="Refresh" onClick={onRefresh} />
          <BigButton icon="add" label="New deck" primary onClick={onCreate} />
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="text-os-text-muted text-sm">Loading decks…</div>
        ) : decks.length === 0 ? (
          <div className="text-os-text-muted text-sm">No decks yet. Click "New deck" to create one.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {decks.map((d) => (
              <div
                key={d.id}
                className="group rounded-2xl bg-os-surface border border-os-border p-5 flex flex-col gap-3 hover:shadow-panel transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-os-text truncate">{d.title}</h3>
                      {d.isBuiltin && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-os-accent/15 text-os-accent border border-os-accent/30">
                          BUILT-IN
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-os-text-muted line-clamp-2">
                      {d.description || 'No description'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[12px] text-os-text-muted">
                  <span>{d.slideCount} slide{d.slideCount === 1 ? '' : 's'}</span>
                  <span>{fmtDate(d.updatedAt)}</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <BigButton icon="play_arrow" label="Play" primary onClick={() => onOpen(d.id)} />
                  {!d.isBuiltin && (
                    <BigButton
                      icon="delete"
                      label="Delete"
                      onClick={() => {
                        if (window.confirm(`Delete "${d.title}"?`)) onDelete(d.id)
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Slide renderer ────────────────────────────────────────────────────────────
function SlideView({ slide, index, total }) {
  const layout = slide.layout || 'content'

  const Body = () => (
    <p className="text-os-text whitespace-pre-wrap leading-relaxed"
       style={{ fontSize: 'clamp(20px, 2.6vw, 32px)', maxWidth: 1100 }}>
      {slide.body}
    </p>
  )

  const Title = ({ size }) => (
    <h2 className="font-semibold text-os-text leading-tight"
        style={{ fontSize: size }}>
      {slide.title}
    </h2>
  )

  let content
  if (layout === 'title') {
    content = (
      <div className="text-center max-w-4xl">
        <Title size="clamp(48px, 6vw, 88px)" />
        {slide.body && <p className="mt-6 text-os-text-muted" style={{ fontSize: 'clamp(20px, 2.4vw, 28px)' }}>{slide.body}</p>}
      </div>
    )
  } else if (layout === 'quote') {
    content = (
      <div className="max-w-3xl text-center">
        <span className="material-symbols-outlined text-[64px] text-os-accent opacity-50">format_quote</span>
        <Title size="clamp(28px, 4vw, 48px)" />
        {slide.body && <p className="mt-5 text-os-text-muted" style={{ fontSize: 'clamp(18px, 2vw, 24px)' }}>{slide.body}</p>}
      </div>
    )
  } else if (layout === 'image' && slide.image) {
    content = (
      <div className="flex flex-col items-center gap-5 max-w-4xl">
        {slide.title && <Title size="clamp(28px, 3.5vw, 44px)" />}
        <img src={slide.image} alt={slide.title || ''} className="max-w-full max-h-[55vh] rounded-2xl shadow-panel" />
        {slide.body && <Body />}
      </div>
    )
  } else if (layout === 'split' && slide.image) {
    content = (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-6xl">
        <img src={slide.image} alt={slide.title || ''} className="max-w-full max-h-[55vh] rounded-2xl shadow-panel" />
        <div>
          <Title size="clamp(28px, 3.5vw, 44px)" />
          <div className="mt-4"><Body /></div>
        </div>
      </div>
    )
  } else {
    content = (
      <div className="max-w-4xl">
        <Title size="clamp(28px, 3.5vw, 44px)" />
        <div className="mt-6"><Body /></div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center px-10 py-12">
      {content}
      <div className="absolute bottom-4 right-6 text-[12px] text-os-text-muted tabular-nums">
        Slide {index + 1} / {total}
      </div>
    </div>
  )
}

// ── Player view ───────────────────────────────────────────────────────────────
function Player({ deck, onClose, onSlideChange }) {
  const slides = deck.slides || []
  const [index, setIndex] = useState(0)
  const [auto, setAuto] = useState(false)
  const autoTimerRef = useRef(null)
  const ttsEnabled = useOsStore((s) => s.ttsEnabled)

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1 < slides.length ? i + 1 : i))
  }, [slides.length])

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : 0))
  }, [])

  const readAloud = useCallback(() => {
    const s = slides[index]
    if (!s) return
    cancelSpeech()
    const text = [s.title, s.body].filter(Boolean).join('. ')
    if (text.trim()) speak(text, { rate: 0.95 })
  }, [slides, index])

  // Auto-advance timer
  useEffect(() => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    if (!auto) return
    if (index >= slides.length - 1) { setAuto(false); return }
    autoTimerRef.current = setTimeout(goNext, AUTO_ADVANCE_MS)
    return () => clearTimeout(autoTimerRef.current)
  }, [auto, index, slides.length, goNext])

  // Auto-read on slide change when TTS is enabled
  useEffect(() => {
    onSlideChange?.(index)
    if (ttsEnabled) {
      // Small delay so the new slide renders before speech starts
      const t = setTimeout(readAloud, 250)
      return () => { clearTimeout(t); cancelSpeech() }
    }
  }, [index, ttsEnabled, readAloud, onSlideChange])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goNext() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
      else if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); readAloud() }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setAuto((a) => !a) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev, onClose, readAloud])

  // External (voice / gesture) navigation events
  useEffect(() => {
    const onSpiritEvent = (e) => {
      const cmd = e?.detail?.cmd
      if (cmd === 'next')   goNext()
      if (cmd === 'prev')   goPrev()
      if (cmd === 'read')   readAloud()
      if (cmd === 'toggle') setAuto((a) => !a)
      if (cmd === 'close')  onClose()
    }
    window.addEventListener('spiritos:presentation', onSpiritEvent)
    return () => window.removeEventListener('spiritos:presentation', onSpiritEvent)
  }, [goNext, goPrev, readAloud, onClose])

  const slide = slides[index] || { title: '(empty)', body: '' }
  const progress = slides.length ? ((index + 1) / slides.length) * 100 : 0

  return (
    <div className="h-full w-full flex flex-col bg-os-bg-primary relative overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-os-border bg-os-surface/60">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-[13px] text-os-text-muted hover:text-os-text bg-os-surface border border-os-border flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Library
          </button>
          <div className="truncate font-semibold text-os-text">{deck.title}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={readAloud}
            className="px-3 py-1.5 rounded-xl text-[13px] bg-os-surface border border-os-border text-os-text hover:bg-os-surface-hover flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">record_voice_over</span>
            Read aloud
          </button>
          <button
            onClick={() => setAuto((a) => !a)}
            className={`px-3 py-1.5 rounded-xl text-[13px] flex items-center gap-1 border ${
              auto
                ? 'bg-os-accent text-white border-os-accent'
                : 'bg-os-surface border-os-border text-os-text hover:bg-os-surface-hover'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{auto ? 'pause' : 'play_arrow'}</span>
            {auto ? 'Pause auto' : 'Auto-play'}
          </button>
        </div>
      </div>

      {/* Slide stage */}
      <div className="flex-1 relative">
        <SlideView slide={slide} index={index} total={slides.length} />
      </div>

      {/* Progress + nav */}
      <div className="px-6 pt-2 pb-4 border-t border-os-border bg-os-surface/60">
        <div className="h-1 rounded-full bg-os-border overflow-hidden mb-3">
          <div className="h-full bg-os-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <BigButton icon="chevron_left" label="Previous" onClick={goPrev} disabled={index === 0} />
          <div className="text-[12px] text-os-text-muted">
            ← / → or space • R = read aloud • F = auto-play • Esc = close
          </div>
          <BigButton icon="chevron_right" label="Next" primary onClick={goNext} disabled={index >= slides.length - 1} />
        </div>
      </div>
    </div>
  )
}

// ── Editor (for "New deck") ───────────────────────────────────────────────────
function NewDeckDialog({ onCancel, onCreate }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!title.trim()) { setErr('Title is required'); return }
    setBusy(true); setErr('')
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        slides: [
          { layout: 'title',   title: title.trim(), body: description.trim() || 'Press the green Next button to add slides.' },
          { layout: 'content', title: 'Slide 2',    body: 'Open this deck again from the library to edit slides later.' }
        ]
      })
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Failed to create')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="absolute inset-0 z-50 bg-backdrop backdrop-blur-sm flex items-center justify-center">
      <div className="w-[480px] bg-os-bg-primary rounded-2xl border border-os-border shadow-window p-6">
        <h3 className="text-lg font-semibold text-os-text mb-1">New deck</h3>
        <p className="text-[12px] text-os-text-muted mb-4">
          Decks save to the database and stay across restarts.
        </p>
        <label className="block text-[12px] text-os-text-muted mb-1">Title</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="My first deck"
          className="w-full px-3 py-2 rounded-xl bg-os-surface border border-os-border text-os-text outline-none focus:border-os-accent mb-3"
        />
        <label className="block text-[12px] text-os-text-muted mb-1">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="What this deck is for"
          className="w-full px-3 py-2 rounded-xl bg-os-surface border border-os-border text-os-text outline-none focus:border-os-accent mb-3 resize-none"
        />
        {err && <div className="text-red-400 text-[12px] mb-2">{err}</div>}
        <div className="flex justify-end gap-2 mt-2">
          <BigButton icon="close" label="Cancel" onClick={onCancel} />
          <BigButton icon="check" label={busy ? 'Creating…' : 'Create'} primary onClick={submit} disabled={busy} />
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Presentation({ initialDeckId } = {}) {
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeDeck, setActiveDeck] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const setPresentationActive = useOsStore((s) => s.setPresentationActive)

  // If the host opened the window with `props={ initialDeckId }`, jump straight in
  const initialIdRef = useRef(initialDeckId)

  const fetchAll = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await axios.get('/api/presentations')
      setDecks(r.data || [])
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Auto-open initial deck once we have data
  useEffect(() => {
    if (!initialIdRef.current || activeDeck || loading) return
    const target = decks.find((d) => d.id === initialIdRef.current)
    if (target) {
      // We need full slides — list endpoint already includes them
      setActiveDeck(target)
      initialIdRef.current = null
    }
  }, [decks, loading, activeDeck])

  // Mark presentation mode active globally so voice/gesture controllers can route
  useEffect(() => {
    setPresentationActive?.(!!activeDeck)
    return () => setPresentationActive?.(false)
  }, [activeDeck, setPresentationActive])

  const openDeck = async (id) => {
    try {
      const r = await axios.get(`/api/presentations/${id}`)
      setActiveDeck(r.data)
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to open')
    }
  }

  const createDeck = async (payload) => {
    const r = await axios.post('/api/presentations', payload)
    setShowNew(false)
    await fetchAll()
    setActiveDeck(r.data)
  }

  const deleteDeck = async (id) => {
    try {
      await axios.delete(`/api/presentations/${id}`)
      await fetchAll()
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to delete')
    }
  }

  const sortedDecks = useMemo(() => decks, [decks])

  return (
    <div className="h-full w-full relative">
      {activeDeck ? (
        <Player deck={activeDeck} onClose={() => setActiveDeck(null)} />
      ) : (
        <Library
          decks={sortedDecks}
          loading={loading}
          error={error}
          onOpen={openDeck}
          onCreate={() => setShowNew(true)}
          onDelete={deleteDeck}
          onRefresh={fetchAll}
        />
      )}
      {showNew && <NewDeckDialog onCancel={() => setShowNew(false)} onCreate={createDeck} />}
    </div>
  )
}

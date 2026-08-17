import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { APPS, ICON_STYLES, getDefaultSize } from '../config/appConfig'
import useSystemInfo from '../hooks/useSystemInfo'
import useWindowStore from '../store/windowStore'

const PINNED = ['FileExplorer', 'Terminal', 'Notes', 'Presentation', 'Reminders']

// ── Live, working Pomodoro timer (real countdown, no static "25:00") ──
function FocusTimer() {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current)
          setRunning(false)
          // Notify on finish
          try { new Audio('/sounds/Awake.mp3').play().catch(() => {}) } catch (_) {}
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [running])

  const reset = () => { setRunning(false); setSecondsLeft(25 * 60) }
  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, '0')
  const ss = (secondsLeft % 60).toString().padStart(2, '0')

  return (
    <div className="rounded-2xl bg-os-accent/10 border border-os-accent/20 p-3">
      <div className="text-[10px] font-semibold text-os-accent mb-1.5 uppercase tracking-widest">Focus</div>
      <div className="text-[22px] font-light text-os-accent tabular-nums">{mm}:{ss}</div>
      <div className="text-[10px] text-os-text-muted mb-2">
        {running ? 'Stay focused.' : secondsLeft === 0 ? 'Time! Take a break.' : 'Tap to begin a 25-min session.'}
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => setRunning((r) => !r)}
          className="flex-1 text-[11px] font-medium text-white bg-os-accent rounded-xl py-1.5 hover:opacity-90 transition">
          {running ? 'Pause' : (secondsLeft === 0 ? 'Restart' : 'Start')}
        </button>
        <button
          onClick={reset}
          className="text-[11px] font-medium text-fg-mut surface-1 rounded-xl py-1.5 px-2 hover:bg-os-surface-hover">
          Reset
        </button>
      </div>
    </div>
  )
}

// ── Live system widget — battery + memory + online status ──
function SystemWidget({ batteryLevel, charging, online }) {
  const [memoryMB, setMemoryMB] = useState(null)

  useEffect(() => {
    const sample = () => {
      try {
        const m = performance.memory
        if (m && typeof m.usedJSHeapSize === 'number') {
          setMemoryMB(Math.round(m.usedJSHeapSize / 1048576))
        }
      } catch (_) {}
    }
    sample()
    const t = setInterval(sample, 2000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="rounded-2xl bg-os-surface border border-os-border p-3">
      <div className="text-[10px] font-semibold text-os-text-muted mb-2.5 uppercase tracking-widest">System</div>
      <div className="flex items-center gap-2">
        <div className="relative w-10 h-10 flex-shrink-0"
          style={{ background: `conic-gradient(#5b5fc7 ${batteryLevel * 3.6}deg, #e8eaf6 0deg)`, borderRadius: '50%' }}>
          <div className="absolute inset-1 bg-os-surface rounded-full flex items-center justify-center text-[10px] font-bold text-os-accent">
            {batteryLevel}%
          </div>
        </div>
        <div>
          <div className="text-[11px] font-medium text-os-text">
            {charging ? 'Charging' : 'On battery'}
          </div>
          <div className="text-[10px] text-os-text-muted">
            {memoryMB != null ? `Heap: ${memoryMB} MB` : online ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>
    </div>
  )
}

function AppLauncher({ onClose, onOpen }) {
  const [search, setSearch] = useState('')
  const [welcomeId, setWelcomeId] = useState(null)
  const ref = useRef(null)
  const inputRef = useRef(null)
  const sysInfo = useSystemInfo()
  const openWindow = useWindowStore((s) => s.openWindow)

  // Fetch the welcome deck id once so the help shortcut goes straight to it.
  useEffect(() => {
    axios.get('/api/presentations')
      .then((r) => {
        const list = r.data || []
        const w = list.find((d) => d.isBuiltin && /welcome/i.test(d.title)) || list.find((d) => d.isBuiltin)
        if (w) setWelcomeId(w.id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return }
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', handler)
    }
  }, [onClose])

  const allApps = Object.entries(APPS).filter(([key]) => key !== 'PdfViewer' && key !== 'ImageViewer')
  const filtered = search
    ? allApps.filter(([, v]) => v.name.toLowerCase().includes(search.toLowerCase()))
    : allApps
  const pinnedApps = allApps.filter(([k]) => PINNED.includes(k))

  const openHelp = useCallback(() => {
    openWindow(
      'Presentation', 'Welcome tour', getDefaultSize('Presentation'),
      welcomeId ? { initialDeckId: welcomeId } : {}
    )
    onClose()
  }, [openWindow, welcomeId, onClose])

  return (
    <div className="fixed inset-0 z-[400] bg-backdrop backdrop-blur-sm flex items-end justify-center pb-20">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="glass-panel rounded-3xl w-[600px] max-h-[480px] flex overflow-hidden shadow-window"
      >
        {/* LEFT: App list */}
        <div className="flex-1 flex flex-col p-5 min-w-0">
          {!search && (
            <>
              <div className="text-[11px] font-semibold text-os-text-muted mb-3 uppercase tracking-widest">Pinned</div>
              <div className="grid grid-cols-5 gap-3 mb-5">
                {pinnedApps.map(([key, app]) => {
                  const style = ICON_STYLES[key] || { from: '#6b7280', to: '#4b5563', icon: '◻' }
                  return (
                    <button key={key} onClick={() => onOpen(key)}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-os-surface-hover transition">
                      <div className="w-10 h-10 squircle flex items-center justify-center text-white text-xl shadow"
                        style={{ background: `linear-gradient(145deg,${style.from},${style.to})` }}>
                        {style.icon}
                      </div>
                      <span className="text-[10px] text-os-text font-medium truncate w-full text-center">{app.name}</span>
                    </button>
                  )
                })}
              </div>
              <div className="h-px bg-os-border mb-4" />
            </>
          )}

          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
            {filtered.map(([key, app]) => {
              const style = ICON_STYLES[key] || { from: '#6b7280', to: '#4b5563', icon: '◻' }
              return (
                <button key={key} onClick={() => onOpen(key)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-os-surface-hover transition text-left">
                  <div className="w-8 h-8 squircle flex items-center justify-center text-white text-[16px] shadow-sm flex-shrink-0"
                    style={{ background: `linear-gradient(145deg,${style.from},${style.to})` }}>
                    {style.icon}
                  </div>
                  <span className="text-[13px] text-os-text font-medium">{app.name}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-2xl bg-os-surface border border-bd">
            <span className="material-symbols-outlined text-[16px] text-os-text-muted">search</span>
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Apps"
              className="flex-1 bg-transparent text-[13px] text-os-text placeholder:text-os-text-muted outline-none"
            />
          </div>
        </div>

        {/* RIGHT: Widgets panel — every widget is real, none static */}
        <div className="w-[200px] flex flex-col gap-3 p-4 border-l border-bd bg-os-surface">
          <SystemWidget batteryLevel={sysInfo.batteryLevel} charging={sysInfo.charging} online={sysInfo.online} />
          <FocusTimer />
          <button onClick={openHelp}
            className="flex items-center gap-2 p-3 rounded-2xl bg-os-accent/10 border border-os-accent/30
                       hover:bg-os-accent/20 transition text-os-accent">
            <span className="material-symbols-outlined text-[18px]">help</span>
            <span className="text-[11px] font-medium">Welcome tour</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default AppLauncher

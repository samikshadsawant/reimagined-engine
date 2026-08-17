# SavitaOS → Aladin OS UI Redesign — Claude Code Prompt

Paste everything below this line into Claude Code.

---

You are doing a complete frontend UI redesign of SavitaOS. The project lives at
`client/src/`. The current design is a dark cyberpunk theme. The new design is
a soft light-lavender GNOME-inspired desktop (based on "Aladin OS") with:
- Pastel lavender/periwinkle background with abstract soft blobs
- Frosted-glass white panels
- Large centered desktop clock
- Centered bottom pill dock with squircle gradient app icons
- Top-left "Ask Genie" AI pill and top-right minimal system tray
- Clean white windows with macOS traffic-light controls
- App launcher overlay (pinned + alphabetical list + widgets panel)
- Quick settings right-side panel

Do NOT touch any server files, store logic, hooks, or app content components.
Only redesign these specific files:
  client/src/index.css
  client/tailwind.config.js
  client/src/config/theme.js
  client/src/desktop/Desktop.jsx
  client/src/desktop/Taskbar.jsx
  client/src/desktop/WindowFrame.jsx
  client/src/desktop/DesktopIcon.jsx
  client/src/desktop/ContextMenu.jsx
  client/src/desktop/FeatureBar.jsx
  client/src/config/appConfig.js  (icon color data only, no logic changes)

Also CREATE these two new files:
  client/src/desktop/QuickSettings.jsx
  client/src/desktop/AppLauncher.jsx

Work through each file one by one. After finishing all files, do a single
`npm run build` from the client/ directory to verify no import errors.

════════════════════════════════════════════════════════════════
STEP 1 — client/src/index.css  (FULL REPLACEMENT)
════════════════════════════════════════════════════════════════

Replace the entire file with:

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply m-0 p-0 overflow-hidden;
    font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
    background: #dde1f9;
    color: #1a1a3e;
  }
}

@layer utilities {
  /* Light frosted glass panel */
  .glass-panel {
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.55);
    box-shadow: 0 8px 32px rgba(80, 80, 180, 0.10);
  }

  /* Slightly more opaque variant for windows */
  .glass-window {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(32px) saturate(200%);
    -webkit-backdrop-filter: blur(32px) saturate(200%);
    border: 1px solid rgba(255, 255, 255, 0.6);
    box-shadow: 0 20px 60px rgba(80, 80, 180, 0.18), 0 2px 8px rgba(0,0,0,0.06);
  }

  /* Squircle icon shape */
  .squircle {
    border-radius: 28%;
  }

  /* Dock pill */
  .dock-pill {
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(28px) saturate(160%);
    -webkit-backdrop-filter: blur(28px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.65);
    box-shadow: 0 4px 24px rgba(80, 80, 180, 0.14);
  }
}

/* Scrollbar */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(100, 100, 200, 0.2); border-radius: 8px; }
::-webkit-scrollbar-thumb:hover { background: rgba(100, 100, 200, 0.35); }
```

════════════════════════════════════════════════════════════════
STEP 2 — client/tailwind.config.js  (FULL REPLACEMENT)
════════════════════════════════════════════════════════════════

Replace the entire file with:

```js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Core palette — soft lavender system
        'os-bg':          '#dde1f9',   // desktop background
        'os-surface':     'rgba(255,255,255,0.72)',
        'os-text':        '#1a1a3e',
        'os-text-muted':  '#6b6b9a',
        'os-text-hint':   '#9898bb',
        'os-accent':      '#5b5fc7',
        'os-accent-soft': '#eeeeff',
        'os-border':      'rgba(255,255,255,0.55)',

        // Semantic
        'os-danger':  '#ef4444',
        'os-warning': '#f59e0b',
        'os-success': '#10b981',

        // Keep agent colors for AI overlay
        'agent-file':      '#3b82f6',
        'agent-system':    '#f59e0b',
        'agent-knowledge': '#a855f7',
        'agent-assistant': '#6b7280',

        // Legacy aliases so no other component breaks
        'os-bg-primary':       '#dde1f9',
        'os-bg-secondary':     'rgba(255,255,255,0.72)',
        'os-bg-tertiary':      'rgba(255,255,255,0.55)',
        'os-bg-elevated':      'rgba(255,255,255,0.88)',
        'os-text-primary':     '#1a1a3e',
        'os-text-secondary':   '#6b6b9a',
        'os-text-tertiary':    '#9898bb',
        'os-accent-light':     '#8486e8',
        'os-accent-dark':      '#4446b0',
        'os-accent-muted':     'rgba(91,95,199,0.15)',
        'primary':             '#5b5fc7',
        'surface':             'rgba(255,255,255,0.72)',
        'on-surface':          '#1a1a3e',
        'os-info':             '#3b82f6',
        'os-info-muted':       'rgba(59,130,246,0.12)',
        'os-danger-muted':     'rgba(239,68,68,0.12)',
        'os-warning-muted':    'rgba(245,158,11,0.12)',
        'os-success-muted':    'rgba(16,185,129,0.12)',
      },
      fontFamily: {
        sans:           ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono:           ['"JetBrains Mono"', 'monospace'],
        'display-lg':   ['"DM Sans"', 'system-ui', 'sans-serif'],
        'body-xl':      ['"DM Sans"', 'system-ui', 'sans-serif'],
        'body-large':   ['"DM Sans"', 'system-ui', 'sans-serif'],
        'body-normal':  ['"DM Sans"', 'system-ui', 'sans-serif'],
        'window-title': ['"DM Sans"', 'system-ui', 'sans-serif'],
        'mono-label':   ['"JetBrains Mono"', 'monospace'],
        'terminal-text':['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        'DEFAULT': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        'full': '9999px',
      },
      boxShadow: {
        'window': '0 20px 60px rgba(80,80,180,0.18), 0 2px 8px rgba(0,0,0,0.06)',
        'dock':   '0 4px 24px rgba(80,80,180,0.14)',
        'panel':  '0 8px 32px rgba(80,80,180,0.10)',
        'glow':   '0 0 20px rgba(91,95,199,0.20)',
      },
      spacing: {
        'taskbar-height': '56px',
        'window-min-width': '300px',
        'window-min-height': '200px',
      },
    },
  },
  plugins: [],
}
```

════════════════════════════════════════════════════════════════
STEP 3 — client/src/config/theme.js  (FULL REPLACEMENT)
════════════════════════════════════════════════════════════════

Replace the entire file with — keep ALL existing exports so nothing breaks,
just change the values to match the new palette:

```js
export const COLORS = {
  accent: {
    DEFAULT: '#5b5fc7',
    light:   '#8486e8',
    dark:    '#4446b0',
    muted:   'rgba(91,95,199,0.15)'
  },
  bg: {
    primary:  '#dde1f9',
    secondary:'rgba(255,255,255,0.72)',
    tertiary: 'rgba(255,255,255,0.55)',
    elevated: 'rgba(255,255,255,0.88)'
  },
  text: {
    primary:   '#1a1a3e',
    secondary: '#6b6b9a',
    tertiary:  '#9898bb'
  },
  success: '#10b981',
  warning: '#f59e0b',
  danger:  '#ef4444',
  info:    '#3b82f6',
  border: {
    DEFAULT: 'rgba(255,255,255,0.55)',
    light:   'rgba(255,255,255,0.75)',
    focus:   '#5b5fc7'
  },
  glow: {
    accent:  '0 0 20px rgba(91,95,199,0.25)',
    success: '0 0 20px rgba(16,185,129,0.25)',
    danger:  '0 0 20px rgba(239,68,68,0.25)'
  }
}

export const GRADIENTS = {
  wallpaper: [
    'linear-gradient(135deg,#dde1f9 0%,#c9cff5 40%,#e8d5f0 80%,#f0e8fa 100%)',
    'linear-gradient(135deg,#e0e7ff 0%,#c7d2fe 50%,#ede9fe 100%)',
    'linear-gradient(135deg,#f0f4ff 0%,#dde4ff 50%,#ede9fe 100%)',
    'linear-gradient(135deg,#e8f0fe 0%,#d5e3fc 40%,#ede9fe 100%)',
  ],
  overlay: 'linear-gradient(to bottom,transparent 0%,rgba(0,0,0,0.05) 100%)',
  card: 'linear-gradient(180deg,rgba(255,255,255,0.6) 0%,rgba(255,255,255,0.3) 100%)'
}

export const TYPOGRAPHY = {
  fontFamily: {
    display: '"DM Sans",system-ui',
    body:    '"DM Sans",system-ui',
    mono:    '"JetBrains Mono","Fira Code",monospace'
  },
  fontSize: {
    xs:   '0.75rem',
    sm:   '0.875rem',
    base: '1rem',
    lg:   '1.125rem',
    xl:   '1.25rem',
    '2xl':'1.5rem',
    '3xl':'1.875rem',
    '4xl':'2.25rem'
  },
  fontWeight: { normal: 400, medium: 500, semibold: 600 }
}
```

════════════════════════════════════════════════════════════════
STEP 4 — client/src/config/appConfig.js  (add icon colors only)
════════════════════════════════════════════════════════════════

Keep ALL existing logic. Only add a new export called ICON_STYLES right after
the APPS block ends. Do NOT change APPS, DESKTOP_APPS, TASKBAR_APPS, or any
other existing export:

```js
// Aladin-style squircle gradient colors per app
export const ICON_STYLES = {
  FileExplorer: { from: '#3b82f6', to: '#06b6d4', icon: '📁' },
  Terminal:     { from: '#374151', to: '#111827', icon: '⌨️' },
  Calculator:   { from: '#10b981', to: '#059669', icon: '⊞' },
  Notes:        { from: '#f59e0b', to: '#ef4444', icon: '✏️' },
  Browser:      { from: '#6366f1', to: '#3b82f6', icon: '◎' },
  Settings:     { from: '#64748b', to: '#475569', icon: '⚙' },
  VoiceTest:    { from: '#ec4899', to: '#a855f7', icon: '🎤' },
  Translator:   { from: '#8b5cf6', to: '#6366f1', icon: '⇄' },
  Mail:         { from: '#f43f5e', to: '#e11d48', icon: '✉' },
  KnownBook:    { from: '#f97316', to: '#ef4444', icon: '👤' },
}
```

════════════════════════════════════════════════════════════════
STEP 5 — client/src/desktop/DesktopIcon.jsx  (FULL REPLACEMENT)
════════════════════════════════════════════════════════════════

```jsx
import React from 'react'
import { motion } from 'framer-motion'
import { ICON_STYLES } from '../config/appConfig'

function DesktopIcon({ name, appKey, onOpen }) {
  const style = ICON_STYLES[appKey] || { from: '#6b7280', to: '#4b5563', icon: '◻' }

  return (
    <motion.div
      className="flex flex-col items-center gap-2 cursor-pointer w-[72px]"
      whileHover={{ scale: 1.08, y: -3 }}
      whileTap={{ scale: 0.92 }}
      onDoubleClick={onOpen}
    >
      <div
        className="w-[52px] h-[52px] squircle flex items-center justify-center text-white text-2xl shadow-md select-none"
        style={{ background: `linear-gradient(145deg, ${style.from}, ${style.to})` }}
      >
        {style.icon}
      </div>
      <span className="text-[11.5px] font-medium text-os-text text-center leading-tight drop-shadow-sm select-none max-w-full truncate">
        {name}
      </span>
    </motion.div>
  )
}

export default DesktopIcon
```

════════════════════════════════════════════════════════════════
STEP 6 — client/src/desktop/Desktop.jsx  (FULL REPLACEMENT)
════════════════════════════════════════════════════════════════

```jsx
import React, { useState, useEffect } from 'react'
import useWindowStore from '../store/windowStore'
import useOsStore from '../store/osStore'
import Taskbar from './Taskbar'
import WindowFrame from './WindowFrame'
import DesktopIcon from './DesktopIcon'
import ContextMenu from './ContextMenu'
import QuickSettings from './QuickSettings'
import AppLauncher from './AppLauncher'
import useSystemInfo from '../hooks/useSystemInfo'
import { DESKTOP_APPS, getDefaultSize } from '../config/appConfig'

/* ── background blobs ── */
const BG_BLOBS = () => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="b1" cx="50%" cy="50%">
        <stop offset="0%" stopColor="#c7d2fe" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#c7d2fe" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="b2" cx="50%" cy="50%">
        <stop offset="0%" stopColor="#e9d5ff" stopOpacity="0.65" />
        <stop offset="100%" stopColor="#e9d5ff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="b3" cx="50%" cy="50%">
        <stop offset="0%" stopColor="#fbcfe8" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#fbcfe8" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="b4" cx="50%" cy="50%">
        <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse cx="70%" cy="20%" rx="38%" ry="32%" fill="url(#b1)" />
    <ellipse cx="15%" cy="75%" rx="30%" ry="26%" fill="url(#b2)" />
    <ellipse cx="85%" cy="80%" rx="28%" ry="22%" fill="url(#b3)" />
    <ellipse cx="40%" cy="50%" rx="25%" ry="20%" fill="url(#b4)" />
    {/* Wave shape bottom-right */}
    <path d="M 900 600 Q 1000 500 1200 580 Q 1400 650 1350 780 Q 1300 900 1100 850 Z"
      fill="rgba(139,92,246,0.08)" />
    {/* Wave shape bottom */}
    <path d="M 0 700 Q 300 640 600 700 Q 900 760 1200 700 Q 1400 660 1440 700 L 1440 900 L 0 900 Z"
      fill="rgba(147,112,219,0.07)" />
  </svg>
)

function Desktop() {
  const { windows, openWindow } = useWindowStore()
  const { batteryLevel, charging, online } = useSystemInfo()
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 })
  const [clock, setClock] = useState(new Date())
  const [showQuickSettings, setShowQuickSettings] = useState(false)
  const [showLauncher, setShowLauncher] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeStr = clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dateStr = clock.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const dateShort = clock.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const clockFull = clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  const visibleWindows = windows.filter(w => !w.minimized)
  const noWindows = visibleWindows.length === 0

  const openApp = (appName) => openWindow(appName, appName, getDefaultSize(appName))

  const handleContextMenu = (e) => {
    e.preventDefault()
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY })
  }

  const handleContextAction = (action) => {
    switch (action) {
      case 'terminal': openApp('Terminal'); break
      case 'wallpaper': openApp('Settings'); break
      case 'refresh': window.location.reload(); break
    }
  }

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden relative select-none"
      style={{ background: 'linear-gradient(140deg,#e4e8fc 0%,#d8dcf8 35%,#e8d5f0 70%,#f0e8fa 100%)' }}
      onContextMenu={handleContextMenu}
      onClick={() => {
        if (contextMenu.visible) setContextMenu(c => ({ ...c, visible: false }))
      }}
    >
      {/* Background blobs */}
      <BG_BLOBS />

      {/* ── TOP BAR ── */}
      <header className="relative z-20 flex items-center justify-between px-5 pt-3 pb-1 pointer-events-none">
        {/* Left: Ask Genie */}
        <div className="pointer-events-auto">
          <button
            className="flex items-center gap-2 px-4 py-1.5 glass-panel rounded-full text-[13px] font-medium text-os-text-muted hover:text-os-text transition-all hover:shadow-panel"
            onClick={() => setShowLauncher(true)}
          >
            <span className="text-os-accent font-bold text-sm">✦</span>
            Ask Genie
            <span className="material-symbols-outlined text-[16px] text-os-text-muted">mic</span>
          </button>
        </div>

        {/* Right: System tray */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Network */}
          <span className="material-symbols-outlined text-[16px] text-os-text-muted" title={online ? 'Online' : 'Offline'}>
            {online ? 'wifi' : 'wifi_off'}
          </span>
          {/* Battery */}
          <span className="material-symbols-outlined text-[16px] text-os-text-muted">
            {charging ? 'battery_charging_full' : batteryLevel > 50 ? 'battery_full' : 'battery_3_bar'}
          </span>
          {/* Date + Time pill — click opens Quick Settings */}
          <button
            onClick={() => setShowQuickSettings(s => !s)}
            className="glass-panel rounded-full px-3 py-1 text-[12px] font-medium text-os-text flex items-center gap-2 hover:shadow-panel transition-all"
          >
            <span>{dateShort}</span>
            <span className="w-px h-3 bg-os-text/20" />
            <span className="tabular-nums">{timeStr}</span>
          </button>
          {/* Avatar */}
          <button
            onClick={() => setShowQuickSettings(s => !s)}
            className="w-7 h-7 rounded-full bg-gradient-to-br from-os-accent to-purple-400 text-white text-[11px] font-semibold flex items-center justify-center shadow-md"
          >
            U
          </button>
        </div>
      </header>

      {/* ── DESKTOP MAIN ── */}
      <main className="flex-1 relative z-10 flex flex-col items-center pt-6 pb-20 px-8 overflow-hidden"
        onContextMenu={handleContextMenu}>

        {/* Clock + search — shown when no windows open */}
        {noWindows && (
          <div className="flex flex-col items-center mb-8 mt-2">
            <div className="text-[80px] font-light tracking-tight text-os-accent leading-none mb-1 tabular-nums"
              style={{ fontWeight: 300, color: '#4a4fb0' }}>
              {clockFull}
            </div>
            <div className="text-[17px] text-os-text-muted font-medium mb-5">{dateStr}</div>
            <button
              className="flex items-center gap-2 px-6 py-2 glass-panel rounded-full text-os-text-muted text-[13px] hover:shadow-panel transition-all w-56 justify-center"
              onClick={() => setShowLauncher(true)}
            >
              <span className="material-symbols-outlined text-[16px]">search</span>
              Search Apps
            </button>
          </div>
        )}

        {/* Desktop icons grid */}
        <div className="grid gap-5 content-start"
          style={{ gridTemplateColumns: 'repeat(auto-fill, 72px)' }}>
          {DESKTOP_APPS.map((app) => (
            <DesktopIcon
              key={app.app}
              name={app.name}
              appKey={app.app}
              onOpen={() => openApp(app.app)}
            />
          ))}
        </div>
      </main>

      {/* ── WINDOWS LAYER ── */}
      <div className="fixed inset-0 z-[100] pointer-events-none">
        <div className="relative w-full h-full pointer-events-none">
          {visibleWindows.map(w => (
            <div key={w.id} className="pointer-events-auto">
              <WindowFrame windowData={w} />
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTEXT MENU ── */}
      <ContextMenu
        x={contextMenu.x} y={contextMenu.y}
        visible={contextMenu.visible}
        onClose={() => setContextMenu(c => ({ ...c, visible: false }))}
        onAction={handleContextAction}
      />

      {/* ── QUICK SETTINGS PANEL ── */}
      {showQuickSettings && (
        <QuickSettings
          onClose={() => setShowQuickSettings(false)}
          batteryLevel={batteryLevel}
          charging={charging}
          online={online}
        />
      )}

      {/* ── APP LAUNCHER ── */}
      {showLauncher && (
        <AppLauncher
          onClose={() => setShowLauncher(false)}
          onOpen={(appName) => { openApp(appName); setShowLauncher(false) }}
        />
      )}

      {/* ── TASKBAR ── */}
      <Taskbar onLauncherClick={() => setShowLauncher(s => !s)} />
    </div>
  )
}

export default Desktop
```

════════════════════════════════════════════════════════════════
STEP 7 — client/src/desktop/Taskbar.jsx  (FULL REPLACEMENT)
════════════════════════════════════════════════════════════════

```jsx
import React from 'react'
import { motion } from 'framer-motion'
import useWindowStore from '../store/windowStore'
import { TASKBAR_APPS, getDefaultSize, ICON_STYLES } from '../config/appConfig'

function Taskbar({ onLauncherClick }) {
  const { windows, openWindow, focusWindow, restoreWindow } = useWindowStore()

  const handleAppClick = (appName) => {
    const existing = windows.find(w => w.app === appName)
    if (existing) {
      existing.minimized ? restoreWindow(existing.id) : focusWindow(existing.id)
    } else {
      openWindow(appName, appName, getDefaultSize(appName))
    }
  }

  const isActive = (appName) => {
    const w = windows.find(w => w.app === appName)
    return w && !w.minimized && w.focused
  }
  const isOpen = (appName) => windows.some(w => w.app === appName)

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200]">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="dock-pill flex items-center gap-1.5 px-4 h-[60px] rounded-3xl"
      >
        {/* Start / Launcher button */}
        <motion.button
          whileHover={{ scale: 1.12, y: -4 }}
          whileTap={{ scale: 0.92 }}
          onClick={onLauncherClick}
          className="w-[44px] h-[44px] squircle flex items-center justify-center text-white shadow-md mr-1"
          style={{ background: 'linear-gradient(145deg,#6366f1,#4f46e5)' }}
          title="App Launcher"
        >
          <span className="material-symbols-outlined text-[22px]">grid_view</span>
        </motion.button>

        <div className="w-px h-8 bg-os-accent/15 mx-0.5" />

        {/* App dock icons */}
        {TASKBAR_APPS.map((app) => {
          const style = ICON_STYLES[app.app] || { from: '#6b7280', to: '#4b5563', icon: '◻' }
          const active = isActive(app.app)
          const open = isOpen(app.app)

          return (
            <div key={app.app} className="relative flex flex-col items-center">
              <motion.button
                whileHover={{ scale: 1.18, y: -6 }}
                whileTap={{ scale: 0.90 }}
                onClick={() => handleAppClick(app.app)}
                className={`w-[44px] h-[44px] squircle flex items-center justify-center text-white text-[22px] shadow-md transition-all ${
                  active ? 'ring-2 ring-white/70 ring-offset-1 ring-offset-transparent' : ''
                }`}
                style={{ background: `linear-gradient(145deg,${style.from},${style.to})` }}
                title={app.name}
              >
                {style.icon}
              </motion.button>

              {/* Active dot */}
              {open && (
                <div className={`absolute -bottom-1.5 w-1 h-1 rounded-full ${
                  active ? 'bg-os-accent shadow-glow' : 'bg-os-text-muted/50'
                }`} />
              )}
            </div>
          )
        })}
      </motion.div>
    </div>
  )
}

export default Taskbar
```

════════════════════════════════════════════════════════════════
STEP 8 — client/src/desktop/WindowFrame.jsx  (FULL REPLACEMENT)
════════════════════════════════════════════════════════════════

Keep ALL logic identical (Rnd, lazy loading, path guidance, etc.).
Only change the visual classes and color values. Specifically:

1. Replace `glass-panel` className with `glass-window`
2. Title bar: change from dark gradient to:
   ```
   className="window-drag-handle h-10 flex items-center px-4
     bg-white/60 border-b border-black/5 flex-shrink-0
     cursor-default select-none"
   ```
3. Title text: change to `text-os-text text-[13px] font-medium`
4. App icon span: change to `text-os-text-muted`
5. Window content area: change `bg-os-bg-primary/95` to `bg-white/90`
6. Traffic light buttons — keep exact same macOS style, no changes needed
7. Unfocused window: change `opacity-[0.85]` to `opacity-[0.80]`
8. The `focused` shadow: change to
   `shadow-window ring-1 ring-white/40`
9. `rounded-2xl` stays the same

Tip: the easiest approach is to keep the entire existing file and do a
targeted string replacement on just the className props listed above.

════════════════════════════════════════════════════════════════
STEP 9 — client/src/desktop/ContextMenu.jsx  (FULL REPLACEMENT)
════════════════════════════════════════════════════════════════

```jsx
import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CONTEXT_MENU_ITEMS } from '../config/appConfig'

function ContextMenu({ x, y, visible, onClose, onAction }) {
  const menuRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    if (visible) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [visible, onClose])

  const ax = Math.min(x, window.innerWidth  - 220)
  const ay = Math.min(y, window.innerHeight - 220)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.94, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -6 }}
          transition={{ duration: 0.12 }}
          className="fixed glass-panel rounded-2xl py-2 z-[9998] min-w-[200px] shadow-panel"
          style={{ left: ax, top: ay }}
        >
          {CONTEXT_MENU_ITEMS.map((item, i) => (
            <button
              key={i}
              onClick={() => { onAction(item.action); onClose() }}
              className="w-[calc(100%-8px)] mx-1 px-4 py-2 text-left flex items-center gap-3
                hover:bg-os-accent/10 rounded-xl transition-colors text-[13px] text-os-text font-medium"
            >
              <span className="text-os-text-muted text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ContextMenu
```

════════════════════════════════════════════════════════════════
STEP 10 — client/src/desktop/FeatureBar.jsx  (FULL REPLACEMENT)
════════════════════════════════════════════════════════════════

The FeatureBar is moved from top-of-screen to a compact icon row inside
the QuickSettings panel. This file becomes a small floating accessibility
toolbar docked at the top-left below the Ask Genie pill:

```jsx
import React from 'react'
import { motion } from 'framer-motion'
import useOsStore from '../store/osStore'

const FEATURE_BTNS = [
  { key: 'gestureEnabled',     toggle: 'toggleGesture',      icon: 'gesture',     label: 'Gesture' },
  { key: 'voiceEnabled',       toggle: 'toggleVoice',        icon: 'mic',         label: 'Voice' },
  { key: 'eyeTrackingEnabled', toggle: 'toggleEyeTracking',  icon: 'visibility',  label: 'Eye' },
  { key: 'ttsEnabled',         toggle: 'toggleTTS',          icon: 'record_voice_over', label: 'TTS' },
  { key: 'visualAlertsEnabled',toggle: 'toggleVisualAlerts', icon: 'notifications', label: 'Alerts' },
]

function FeatureBar() {
  const store = useOsStore()

  return (
    <div className="fixed top-14 left-5 z-30 flex flex-col gap-1.5 pointer-events-auto">
      {FEATURE_BTNS.map(({ key, toggle, icon, label }) => {
        const active = store[key]
        return (
          <motion.button
            key={key}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={store[toggle]}
            title={label}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-sm ${
              active
                ? 'bg-os-accent text-white shadow-glow'
                : 'glass-panel text-os-text-muted hover:text-os-text'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{icon}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

export default FeatureBar
```

Also: In Desktop.jsx import FeatureBar and render it above the main area
(it is already in the existing Desktop.jsx; after your replacement in STEP 6
it is NOT included, so add `<FeatureBar />` as a sibling right after `<BG_BLOBS />`
with `import FeatureBar from './FeatureBar'` at the top).

════════════════════════════════════════════════════════════════
STEP 11 — CREATE client/src/desktop/QuickSettings.jsx  (NEW FILE)
════════════════════════════════════════════════════════════════

```jsx
import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useOsStore from '../store/osStore'

function Toggle({ label, checked, onChange, icon }) {
  return (
    <button
      onClick={onChange}
      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl text-[11px] font-medium transition-all ${
        checked
          ? 'bg-os-accent/15 text-os-accent border border-os-accent/25'
          : 'bg-white/50 text-os-text-muted border border-white/60 hover:bg-white/70'
      }`}
    >
      <span className="material-symbols-outlined text-[20px]" style={checked ? { fontVariationSettings:"'FILL' 1" } : {}}>
        {icon}
      </span>
      {label}
    </button>
  )
}

function QuickSettings({ onClose, batteryLevel, charging, online }) {
  const ref = useRef(null)
  const { voiceEnabled, toggleVoice, gestureEnabled, toggleGesture } = useOsStore()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: 20, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className="fixed top-12 right-4 z-[300] w-[280px] glass-panel rounded-3xl p-4 shadow-window"
    >
      {/* User row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-os-accent to-purple-400 text-white text-[13px] font-semibold flex items-center justify-center shadow">
            U
          </div>
          <div>
            <div className="text-[13px] font-semibold text-os-text">User</div>
            <div className="text-[11px] text-os-text-muted">SavitaOS</div>
          </div>
        </div>
        <button className="text-[11px] text-os-text-muted px-2.5 py-1 rounded-lg bg-white/50 hover:bg-white/80 transition border border-white/50 font-medium">
          Logout
        </button>
      </div>

      {/* Toggles grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Toggle
          label={online ? 'FritoBox' : 'Offline'}
          checked={online}
          onChange={() => {}}
          icon="wifi"
        />
        <Toggle
          label="Bluetooth"
          checked={false}
          onChange={() => {}}
          icon="bluetooth"
        />
        <Toggle
          label="Dark Mode"
          checked={false}
          onChange={() => {}}
          icon="dark_mode"
        />
        <Toggle
          label="Night Light"
          checked={false}
          onChange={() => {}}
          icon="nights_stay"
        />
      </div>

      {/* Separator */}
      <div className="h-px bg-black/6 my-3" />

      {/* Now Playing placeholder */}
      <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/50 border border-white/60 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-lg shadow">
          ♪
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-os-text truncate">Now Playing</div>
          <div className="text-[11px] text-os-text-muted truncate">No track playing</div>
        </div>
        <button className="text-os-text-muted hover:text-os-text transition">
          <span className="material-symbols-outlined text-[20px]">play_circle</span>
        </button>
      </div>

      {/* Battery */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-[12px] text-os-text-muted">
          <span className="material-symbols-outlined text-[18px]">
            {charging ? 'battery_charging_full' : batteryLevel > 50 ? 'battery_full' : 'battery_3_bar'}
          </span>
          <div className="w-32 h-2 rounded-full bg-black/8 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${batteryLevel > 30 ? 'bg-os-success' : 'bg-os-danger'}`}
              style={{ width: `${batteryLevel}%` }}
            />
          </div>
          <span className="font-medium text-os-text">{batteryLevel}%</span>
        </div>
        <button className="text-[11px] text-os-text-muted hover:text-os-text transition font-medium">
          Customize
        </button>
      </div>
    </motion.div>
  )
}

export default QuickSettings
```

════════════════════════════════════════════════════════════════
STEP 12 — CREATE client/src/desktop/AppLauncher.jsx  (NEW FILE)
════════════════════════════════════════════════════════════════

```jsx
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { APPS, ICON_STYLES } from '../config/appConfig'
import useSystemInfo from '../hooks/useSystemInfo'

const PINNED = ['Mail', 'VoiceTest', 'Notes', 'Terminal']

function AppLauncher({ onClose, onOpen }) {
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)
  const { batteryLevel } = useSystemInfo()

  useEffect(() => {
    inputRef.current?.focus()
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', handler)
    }
  }, [onClose])

  const allApps = Object.entries(APPS)
  const filtered = search
    ? allApps.filter(([, v]) => v.name.toLowerCase().includes(search.toLowerCase()))
    : allApps

  const pinnedApps = allApps.filter(([k]) => PINNED.includes(k))

  return (
    <div className="fixed inset-0 z-[400] bg-black/10 backdrop-blur-sm flex items-end justify-center pb-20">
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
          {/* Pinned */}
          {!search && (
            <>
              <div className="text-[11px] font-semibold text-os-text-muted mb-3 uppercase tracking-widest">Pinned</div>
              <div className="grid grid-cols-4 gap-3 mb-5">
                {pinnedApps.map(([key, app]) => {
                  const style = ICON_STYLES[key] || { from: '#6b7280', to: '#4b5563', icon: '◻' }
                  return (
                    <button
                      key={key}
                      onClick={() => onOpen(key)}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-white/50 transition"
                    >
                      <div
                        className="w-10 h-10 squircle flex items-center justify-center text-white text-xl shadow"
                        style={{ background: `linear-gradient(145deg,${style.from},${style.to})` }}
                      >
                        {style.icon}
                      </div>
                      <span className="text-[10px] text-os-text font-medium truncate w-full text-center">{app.name}</span>
                    </button>
                  )
                })}
              </div>
              <div className="h-px bg-black/6 mb-4" />
            </>
          )}

          {/* All / filtered apps */}
          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
            {filtered.map(([key, app]) => {
              const style = ICON_STYLES[key] || { from: '#6b7280', to: '#4b5563', icon: '◻' }
              return (
                <button
                  key={key}
                  onClick={() => onOpen(key)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/50 transition text-left"
                >
                  <div
                    className="w-8 h-8 squircle flex items-center justify-center text-white text-[16px] shadow-sm flex-shrink-0"
                    style={{ background: `linear-gradient(145deg,${style.from},${style.to})` }}
                  >
                    {style.icon}
                  </div>
                  <span className="text-[13px] text-os-text font-medium">{app.name}</span>
                </button>
              )
            })}
          </div>

          {/* Search bar at bottom */}
          <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/50 border border-white/60">
            <span className="material-symbols-outlined text-[16px] text-os-text-muted">search</span>
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Apps"
              className="flex-1 bg-transparent text-[13px] text-os-text placeholder:text-os-text-muted outline-none"
            />
            <button
              className="w-6 h-6 rounded-lg bg-white/60 flex items-center justify-center text-os-text-muted text-[12px]"
              onClick={() => {}}
              title="App grid view"
            >
              ⊞
            </button>
          </div>
        </div>

        {/* RIGHT: Widgets panel */}
        <div className="w-[200px] flex flex-col gap-3 p-4 border-l border-white/40 bg-white/20">
          {/* System Monitor widget */}
          <div className="rounded-2xl bg-white/60 border border-white/70 p-3">
            <div className="text-[10px] font-semibold text-os-text-muted mb-2.5 uppercase tracking-widest">System</div>
            <div className="flex items-center gap-2">
              <div
                className="relative w-10 h-10 flex-shrink-0"
                style={{
                  background: `conic-gradient(#5b5fc7 ${batteryLevel * 3.6}deg, #e8eaf6 0deg)`,
                  borderRadius: '50%'
                }}
              >
                <div className="absolute inset-1 bg-white/80 rounded-full flex items-center justify-center text-[10px] font-bold text-os-accent">
                  {batteryLevel}%
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-os-text">Battery</div>
                <div className="text-[10px] text-os-text-muted">CPU: OK</div>
              </div>
            </div>
          </div>

          {/* Focus timer widget */}
          <div className="rounded-2xl bg-os-accent/10 border border-os-accent/20 p-3">
            <div className="text-[10px] font-semibold text-os-accent mb-1.5 uppercase tracking-widest">Focus</div>
            <div className="text-[22px] font-light text-os-accent tabular-nums">25:00</div>
            <div className="text-[10px] text-os-text-muted mb-2">Take a break</div>
            <button className="w-full text-[11px] font-medium text-white bg-os-accent rounded-xl py-1.5 hover:bg-os-accent-dark transition">
              Start
            </button>
          </div>

          {/* Screen capture */}
          <button
            onClick={() => onOpen('Settings')}
            className="flex items-center gap-2 p-3 rounded-2xl bg-white/60 border border-white/70 hover:bg-white/80 transition"
          >
            <span className="material-symbols-outlined text-[18px] text-os-text-muted">screenshot_monitor</span>
            <span className="text-[11px] font-medium text-os-text">Screen Capture</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default AppLauncher
```

════════════════════════════════════════════════════════════════
STEP 13 — FINAL WIRING & VERIFICATION
════════════════════════════════════════════════════════════════

After completing all file changes above, do these final checks:

1. In Desktop.jsx (STEP 6), ensure these imports are at the top:
   ```js
   import FeatureBar from './FeatureBar'
   import QuickSettings from './QuickSettings'
   import AppLauncher from './AppLauncher'
   ```
   And render `<FeatureBar />` as the first child inside the outer div,
   right after `<BG_BLOBS />`.

2. In Taskbar.jsx (STEP 7), verify ICON_STYLES is exported from appConfig.js
   and imported correctly.

3. In client/index.html (do NOT replace, only check): verify the Material
   Symbols font link is present. If not, add inside <head>:
   ```html
   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
   ```

4. Run from client/ directory:
   ```
   npm run build 2>&1 | tail -30
   ```
   Fix any "Cannot find module" or "is not exported" errors.
   Common fix: if ICON_STYLES import fails in Taskbar.jsx, check the exact
   export name in appConfig.js matches the import.

5. Run `npm run dev` and open localhost:5173 to verify:
   ✓ Soft lavender gradient background with blobs visible
   ✓ Large centered clock when no windows open
   ✓ Bottom dock with colorful squircle icons
   ✓ Top-left Ask Genie pill
   ✓ Top-right date/time → opens QuickSettings
   ✓ Clicking grid_view icon → opens AppLauncher overlay
   ✓ Windows are white/glass, not dark
   ✓ Context menu is light/glass
   ✓ Accessibility toggle buttons are vertical strip left side

Do NOT change any app content files (FileExplorer, Terminal, Calculator,
Notes, Browser, Settings, etc.) — those are out of scope.

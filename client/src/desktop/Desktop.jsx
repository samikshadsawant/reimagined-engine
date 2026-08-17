import React, { useState, useEffect } from 'react'
import axios from 'axios'
import useWindowStore from '../store/windowStore'
import useOsStore from '../store/osStore'
import Taskbar from './Taskbar'
import WindowFrame from './WindowFrame'
import DesktopIcon from './DesktopIcon'
import ContextMenu from './ContextMenu'
import FeatureBar from './FeatureBar'
import QuickSettings from './QuickSettings'
import AppLauncher from './AppLauncher'
import useSystemInfo from '../hooks/useSystemInfo'
import { DESKTOP_APPS, getDefaultSize } from '../config/appConfig'
import log from '../utils/terminalLogger'

/* ── background blobs (uses theme accent for both light & dark) ── */
const BG_BLOBS = () => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="b1" cx="50%" cy="50%">
        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="b2" cx="50%" cy="50%">
        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.14" />
        <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="b3" cx="50%" cy="50%">
        <stop offset="0%" stopColor="#ec4899" stopOpacity="0.10" />
        <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="b4" cx="50%" cy="50%">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse cx="70%" cy="20%" rx="38%" ry="32%" fill="url(#b1)" />
    <ellipse cx="15%" cy="75%" rx="30%" ry="26%" fill="url(#b2)" />
    <ellipse cx="85%" cy="80%" rx="28%" ry="22%" fill="url(#b3)" />
    <ellipse cx="40%" cy="50%" rx="25%" ry="20%" fill="url(#b4)" />
  </svg>
)

function Desktop() {
  const { windows, openWindow } = useWindowStore()
  const { wallpaper } = useOsStore()
  const { batteryLevel, charging, online } = useSystemInfo()
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 })
  const [clock, setClock] = useState(new Date())
  const [showQuickSettings, setShowQuickSettings] = useState(false)
  const [showLauncher, setShowLauncher] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeStr    = clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dateStr    = clock.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const dateShort  = clock.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const clockFull  = clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  const visibleWindows = windows.filter(w => !w.minimized)
  const noWindows = visibleWindows.length === 0
  const hasMaximizedWindow = visibleWindows.some(w => w.maximized)

  const openApp = (appName) => {
    log.action(`Opened app: ${appName}`)
    openWindow(appName, appName, getDefaultSize(appName))
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    log.info('Right-click context menu opened', { x: e.clientX, y: e.clientY })
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY })
  }

  const handleContextAction = (action) => {
    log.action(`Context menu action: ${action}`)
    switch (action) {
      case 'terminal':  openApp('Terminal'); break
      case 'wallpaper': openApp('Settings'); break
      case 'refresh':   window.location.reload(); break
      case 'newFolder': {
        const name = prompt('New folder name:')
        if (name && name.trim()) {
          axios.post('/api/fs/create', { path: '/', name: name.trim(), type: 'directory' })
            .then(() => log.info(`Created folder: ${name.trim()}`))
            .catch(err => log.error(`Failed to create folder: ${err.message}`))
        }
        break
      }
      case 'newFile': {
        const fileName = prompt('New file name (e.g. notes.txt):')
        if (fileName && fileName.trim()) {
          axios.post('/api/fs/create', { path: '/', name: fileName.trim(), type: 'file', content: '' })
            .then(() => log.info(`Created file: ${fileName.trim()}`))
            .catch(err => log.error(`Failed to create file: ${err.message}`))
        }
        break
      }
      default: break
    }
  }

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden relative select-none desktop-bg"
      style={wallpaper ? { background: wallpaper } : undefined}
      onContextMenu={handleContextMenu}
      onClick={() => {
        if (contextMenu.visible) setContextMenu(c => ({ ...c, visible: false }))
      }}
    >
      {/* Background blobs */}
      <BG_BLOBS />

      {/* Accessibility feature toggles */}
      <FeatureBar />

      {/* ── TOP BAR ── */}
      <header className="relative z-20 flex items-center justify-between px-5 pt-3 pb-1 pointer-events-none">
        {/* Left: Ask Genie */}
        <div className="pointer-events-auto">
          <button
            className="flex items-center gap-2 px-4 py-1.5 glass-panel rounded-full text-[13px] font-medium text-os-text-muted hover:text-os-text transition-all hover:shadow-panel"
            onClick={() => { log.action('Launcher opened via Ask Spirit button'); setShowLauncher(true) }}
          >
            <span className="text-os-accent font-bold text-sm">✦</span>
            Ask Spirit
            <span className="material-symbols-outlined text-[16px] text-os-text-muted">mic</span>
          </button>
        </div>

        {/* Right: System tray */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="material-symbols-outlined text-[16px] text-os-text-muted" title={online ? 'Online' : 'Offline'}>
            {online ? 'wifi' : 'wifi_off'}
          </span>
          <span className="material-symbols-outlined text-[16px] text-os-text-muted">
            {charging ? 'battery_charging_full' : batteryLevel > 50 ? 'battery_full' : 'battery_3_bar'}
          </span>
          {/* Date + Time pill (also opens Quick Settings) */}
          <button
            onClick={() => { log.action('Quick settings toggled'); setShowQuickSettings(s => !s) }}
            className="glass-panel rounded-full px-3 py-1 text-[12px] font-medium text-os-text flex items-center gap-2 hover:shadow-panel transition-all"
          >
            <span>{dateShort}</span>
            <span className="w-px h-3" style={{ background: 'var(--border-strong)' }} />
            <span className="tabular-nums">{timeStr}</span>
          </button>
        </div>
      </header>

      {/* ── DESKTOP MAIN ── */}
      <main className="flex-1 relative z-10 flex flex-col items-center pt-6 pb-20 px-8 overflow-hidden w-full"
        onContextMenu={handleContextMenu}>

        {/* Large clock — shown when no windows open */}
        {noWindows && (
          <div className="flex flex-col items-center w-full mb-6 mt-2">
            <div
              className="text-[80px] font-light tracking-tight leading-none mb-1 tabular-nums text-os-accent"
              style={{ fontWeight: 300 }}
            >
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

        {/* Desktop icons grid — centered horizontally */}
        <div className="flex flex-wrap justify-center gap-5 w-full px-4">
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
      <div className={`fixed inset-0 pointer-events-none ${hasMaximizedWindow ? 'z-[11000]' : 'z-[100]'}`}>
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

      {/* ── QUICK SETTINGS ── */}
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
        onClose={() => { log.action('Launcher closed'); setShowLauncher(false) }}
          onOpen={(appName) => { openApp(appName); setShowLauncher(false) }}
        />
      )}

      {/* ── TASKBAR ── */}
      <Taskbar onLauncherClick={() => setShowLauncher(s => !s)} />
    </div>
  )
}

export default Desktop

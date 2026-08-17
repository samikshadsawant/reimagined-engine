import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import useOsStore from '../store/osStore'
import useWindowStore from '../store/windowStore'
import { getDefaultSize } from '../config/appConfig'

function Toggle({ label, checked, onChange, icon, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl text-[11px] font-medium transition-all
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${checked
          ? 'bg-os-accent/15 text-os-accent border border-os-accent/25'
          : 'surface-1 text-fg-mut border border-bd hover:bg-os-surface-hover'}`}
    >
      <span className="material-symbols-outlined text-[20px]"
        style={checked ? { fontVariationSettings: "'FILL' 1" } : {}}>
        {icon}
      </span>
      {label}
    </button>
  )
}

/**
 * QuickSettings — system tray panel.
 *
 * Every control here drives real state. No static "Logout / Customize" placeholders.
 *  - Voice / Gesture / TTS / Visual alerts toggles drive osStore.
 *  - The "Profile" button opens the Settings app where the user can switch profile.
 *  - The bottom row shows live battery + memory information from the browser
 *    APIs and a real "Open Settings" link.
 */
function QuickSettings({ onClose, batteryLevel, charging, online }) {
  const ref = useRef(null)
  const [memoryMB, setMemoryMB] = useState(null)
  const {
    voiceEnabled, toggleVoice,
    gestureEnabled, toggleGesture,
    ttsEnabled, toggleTTS,
    visualAlertsEnabled, toggleVisualAlerts,
    profile,
  } = useOsStore()
  const openWindow = useWindowStore((s) => s.openWindow)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Sample heap usage every 2 s. Available on Chromium based browsers only.
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

  const openSettings = () => {
    openWindow('Settings', 'Settings', getDefaultSize('Settings'))
    onClose()
  }
  const openReminders = () => {
    openWindow('Reminders', 'Reminders', getDefaultSize('Reminders'))
    onClose()
  }

  const profileLabel = profile?.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

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
            S
          </div>
          <div>
            <div className="text-[13px] font-semibold text-os-text">SpiritOS</div>
            <div className="text-[11px] text-os-text-muted truncate max-w-[140px]">{profileLabel} profile</div>
          </div>
        </div>
        <button
          onClick={openSettings}
          className="text-[11px] text-fg-mut px-2.5 py-1 rounded-lg surface-1 hover:bg-os-surface-hover transition border border-bd font-medium">
          Profile
        </button>
      </div>

      {/* Toggles grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Toggle label={online ? 'Online' : 'Offline'} checked={online}                onChange={() => {}}        disabled icon="wifi" />
        <Toggle label="Voice"                         checked={voiceEnabled}            onChange={toggleVoice}     icon="mic" />
        <Toggle label="Gesture"                       checked={gestureEnabled}          onChange={toggleGesture}   icon="gesture" />
        <Toggle label="Read aloud"                    checked={ttsEnabled}              onChange={toggleTTS}       icon="record_voice_over" />
        <Toggle label="Visual alerts"                 checked={visualAlertsEnabled}     onChange={toggleVisualAlerts} icon="notifications_active" />
        <Toggle label="Reminders"                     checked={false}                   onChange={openReminders}   icon="alarm" />
      </div>

      <div className="h-px my-3" style={{ background: 'var(--border)' }} />

      {/* Battery + memory */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2 text-[12px] text-fg-mut">
          <span className="material-symbols-outlined text-[18px]">
            {charging ? 'battery_charging_full' : batteryLevel > 50 ? 'battery_full' : 'battery_3_bar'}
          </span>
          <div className="w-24 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div
              className={`h-full rounded-full transition-all`}
              style={{
                width: `${batteryLevel}%`,
                background: batteryLevel > 30 ? 'var(--success)' : 'var(--danger)'
              }}
            />
          </div>
          <span className="font-medium text-fg">{batteryLevel}%</span>
        </div>
        <button
          onClick={openSettings}
          className="text-[11px] text-fg-mut hover:text-fg transition font-medium">
          All settings
        </button>
      </div>
      <div className="px-1 text-[11px] text-fg-mut flex items-center gap-2">
        <span className="material-symbols-outlined text-[14px]">memory</span>
        {memoryMB != null ? `App heap: ${memoryMB} MB` : 'Heap stats unavailable'}
      </div>
    </motion.div>
  )
}

export default QuickSettings

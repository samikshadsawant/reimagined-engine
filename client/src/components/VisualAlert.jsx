/**
 * VisualAlert — Hearing-impaired visual notification overlay
 *
 * When `visualAlertsEnabled` is ON in the store, every new notification
 * triggers a full-screen border flash so hearing-impaired users get a
 * strong visual cue instead of (or in addition to) an audio notification.
 *
 * The flash colour matches the notification type:
 *   info  → cyan/blue
 *   warn  → amber/orange
 *   error → red
 */

import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useOsStore from '../store/osStore'

const FLASH_COLORS = {
  info:  { border: 'border-cyan-400',    shadow: 'shadow-cyan-400/40',    bg: 'from-cyan-400/20'  },
  warn:  { border: 'border-amber-400',   shadow: 'shadow-amber-400/40',   bg: 'from-amber-400/20' },
  error: { border: 'border-red-500',     shadow: 'shadow-red-500/40',     bg: 'from-red-500/20'   },
}

export default function VisualAlert() {
  const { notifications, visualAlertsEnabled } = useOsStore()
  const [flash, setFlash] = useState(null) // { type, message }
  const lastIdRef = useRef(null)

  useEffect(() => {
    if (!visualAlertsEnabled) return
    if (notifications.length === 0) return

    const latest = notifications[notifications.length - 1]
    // Only flash for *new* notifications (avoid re-flashing on re-render)
    if (latest.id === lastIdRef.current) return
    lastIdRef.current = latest.id

    setFlash({ type: latest.type || 'info', message: latest.message })

    // Auto-dismiss flash after 1.2 seconds
    const timer = setTimeout(() => setFlash(null), 1200)
    return () => clearTimeout(timer)
  }, [notifications, visualAlertsEnabled])

  if (!visualAlertsEnabled) return null

  const colors = flash ? (FLASH_COLORS[flash.type] || FLASH_COLORS.info) : null

  return (
    <AnimatePresence>
      {flash && (
        <motion.div
          key={flash.message + Date.now()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[99999] pointer-events-none flex items-end justify-center pb-24"
        >
          {/* Full-screen border glow */}
          <div className={`absolute inset-0 border-4 ${colors.border} rounded-none ${colors.shadow} shadow-[inset_0_0_60px] animate-pulse`} />

          {/* Floating alert banner at bottom */}
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0 }}
            className={`px-6 py-3 rounded-xl bg-gradient-to-r ${colors.bg} to-transparent backdrop-blur-xl border ${colors.border} shadow-2xl max-w-lg text-center`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-bounce">🔔</span>
              <span className="text-white font-medium text-sm">
                {flash.message.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/gu, '').trim()}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

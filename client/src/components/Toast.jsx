/**
 * Toast — lightweight, accessible toast notifications.
 *
 * Usage:
 *   const { showToast, ToastContainer } = useToast()
 *   showToast('File moved to Trash', { action: { label: 'Undo', onClick: fn }, duration: 8000 })
 *   <ToastContainer />   ← mount once near the root
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

// ── Shared singleton so multiple callers share the same queue ────────────────
let _dispatch = null
const _listeners = new Set()

function notify(toast) {
  _listeners.forEach(fn => fn(toast))
}

export function showToast(message, opts = {}) {
  notify({ message, ...opts, id: `${Date.now()}_${Math.random().toString(36).slice(2)}` })
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useToast() {
  return { showToast }
}

// ── Container (mount once in App.jsx) ────────────────────────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const handler = (toast) => {
      setToasts(prev => [...prev, toast])
      const duration = toast.duration ?? 5000
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id))
      }, duration)
    }
    _listeners.add(handler)
    return () => _listeners.delete(handler)
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return createPortal(
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200000] flex flex-col gap-2 items-center pointer-events-none"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{    opacity: 0, y: 8,  scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg"
            style={{
              background: 'var(--surface-strong)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text)',
              minWidth: 240,
              maxWidth: 380
            }}
          >
            {toast.icon && (
              <span className="text-[18px] flex-shrink-0">{toast.icon}</span>
            )}
            <span className="flex-1 text-[13px] font-medium">{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => { toast.action.onClick(); dismiss(toast.id) }}
                className="text-[12px] font-semibold px-3 py-1 rounded-lg flex-shrink-0"
                style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(toast.id)}
              className="text-[16px] opacity-50 hover:opacity-100 flex-shrink-0 w-6 h-6 flex items-center justify-center"
              aria-label="Dismiss"
            >
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  )
}

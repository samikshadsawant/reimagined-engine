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
          animate={{ opacity: 1, scale: 1,    y: 0  }}
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
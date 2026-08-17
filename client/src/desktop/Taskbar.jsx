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

        <div className="w-px h-8 mx-0.5" style={{ background: 'var(--border-strong)' }} />

        {/* App dock icons */}
        {TASKBAR_APPS.map((app) => {
          const style = ICON_STYLES[app.app] || { from: '#6b7280', to: '#4b5563', icon: '◻' }
          const active = isActive(app.app)
          const open   = isOpen(app.app)

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
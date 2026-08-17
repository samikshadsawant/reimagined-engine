import React, { lazy, Suspense, useMemo, useRef } from 'react'
import { Rnd } from 'react-rnd'
import { motion, AnimatePresence } from 'framer-motion'
import useWindowStore from '../store/windowStore'
import { APPS, WINDOW_CONFIG } from '../config/appConfig'
import usePathGuidance from '../hooks/usePathGuidance' // Phase 1.2.2

// App icon mappings
const appIcons = {
  FileExplorer: { icon: 'folder',   filled: true  },
  Terminal:     { icon: 'terminal', filled: false },
  Calculator:   { icon: 'calculate', filled: false },
  Notes:        { icon: 'description', filled: false },
  Browser:      { icon: 'public',   filled: false },
  Settings:     { icon: 'settings', filled: false },
  Translator:   { icon: 'translate', filled: false },
  Mail:         { icon: 'mail',     filled: false }, // Phase 4.1
  KnownBook:    { icon: 'contacts', filled: false }, // Phase 2.3
  Presentation: { icon: 'slideshow', filled: false },
  Reminders:    { icon: 'alarm',    filled: false },
  Emergency:    { icon: 'contact_emergency', filled: false },
  Vault:        { icon: 'lock',             filled: false },  // Phase 4.2
  PdfViewer:    { icon: 'picture_as_pdf',   filled: false },  // Phase 6
  ImageViewer:  { icon: 'image',            filled: false }   // Phase 6
}

// Lazy load app components
const apps = {
  FileExplorer: lazy(() => import('../apps/FileExplorer')),
  Terminal:     lazy(() => import('../apps/Terminal')),
  Calculator:   lazy(() => import('../apps/Calculator')),
  Notes:        lazy(() => import('../apps/Notes')),
  Browser:      lazy(() => import('../apps/Browser')),
  Settings:     lazy(() => import('../apps/Settings')),
  Translator:   lazy(() => import('../apps/Translator')),
  Mail:         lazy(() => import('../apps/Mail')),       // Phase 4.1 — stub
  KnownBook:    lazy(() => import('../apps/KnownBook')),  // Phase 2.3
  Presentation: lazy(() => import('../apps/Presentation')),
  Reminders:    lazy(() => import('../apps/Reminders')),
  Emergency:    lazy(() => import('../apps/Emergency')),
  Vault:        lazy(() => import('../apps/Vault')),          // Phase 4.2
  PdfViewer:    lazy(() => import('../apps/PdfViewer')),      // Phase 6
  ImageViewer:  lazy(() => import('../apps/ImageViewer'))     // Phase 6
}

// Loading component
const AppLoader = () => (
  <div className="flex items-center justify-center h-full text-os-text-secondary">
    Loading...
  </div>
)

/**
 * @param {Object} props
 * @param {import('../store/windowStore').Window} props.windowData
 */
function WindowFrame({ windowData }) {
  const {
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    focusWindow,
    updatePosition,
    updateSize
  } = useWindowStore()

  // Phase 1.2.2 — Path guidance: scope the spacebar reader to this window's DOM
  const windowRef = useRef(null)
  const { isReading } = usePathGuidance(windowRef)

  const { id, app, title, x, y, width, height, zIndex, minimized, maximized, focused, props } = windowData

  const AppComponent = useMemo(() => apps[app], [app])
  const appIcon = appIcons[app] || { icon: 'apps', filled: false }

  if (minimized) return null

  const handleClose = (e) => { e.stopPropagation(); closeWindow(id) }
  const handleMinimize = (e) => { e.stopPropagation(); minimizeWindow(id) }
  const handleMaximize = (e) => { e.stopPropagation(); maximizeWindow(id) }
  const handleTitleBarClick = () => { focusWindow(id) }

  // Animation variants
  const openVariants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1, transition: { type: 'spring', duration: 0.15 } },
    exit: { scale: 0.9, opacity: 0, transition: { duration: 0.1 } }
  }

  return (
    <AnimatePresence>
      <Rnd
        className={maximized ? 'window-frame-rnd window-frame-rnd--maximized' : 'window-frame-rnd'}
        size={maximized
          ? { width: '100dvw', height: '100dvh' }
          : { width, height }
        }
        position={maximized ? { x: 0, y: 0 } : { x, y }}
        minWidth={maximized ? 0 : WINDOW_CONFIG.minWidth}
        minHeight={maximized ? 0 : WINDOW_CONFIG.minHeight}
        bounds={maximized ? undefined : "parent"}
        dragHandleClassName="window-drag-handle"
        enableResizing={!maximized}
        disableDragging={maximized}
        onDragStop={(e, d) => updatePosition(id, d.x, d.y)}
        onResizeStop={(e, direction, ref, delta, position) => {
          updateSize(id, parseInt(ref.style.width), parseInt(ref.style.height))
        }}
        style={{ zIndex: maximized ? Math.max(zIndex, 9999) : zIndex }}
        onMouseDown={() => focusWindow(id)}
      >
        <motion.div
          variants={openVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={`h-full flex flex-col glass-window overflow-hidden transition-opacity duration-200 ${
            focused ? 'shadow-window ring-1 ring-white/40' : 'opacity-[0.80] shadow-xl'
          } ${maximized ? 'rounded-none' : 'rounded-2xl'}`}
        >
          {/* TITLE BAR */}
          <div
            className="window-drag-handle h-10 flex items-center px-4 bg-os-surface border-b border-os-border flex-shrink-0 cursor-default select-none"
            onClick={handleTitleBarClick}
          >
            {/* Traffic Lights (left, w-16) */}
            <div className="flex items-center gap-2 w-16 group">
              <button onClick={handleClose} className="w-4 h-4 rounded-full bg-red-500/90 border border-red-400 hover:bg-red-400 transition-colors flex items-center justify-center cursor-pointer shadow-md hover:scale-110">
                <span className="text-[10px] text-red-100 font-bold leading-none select-none opacity-70 hover:opacity-100">✕</span>
              </button>
              <button onClick={handleMinimize} className="w-4 h-4 rounded-full bg-yellow-500/90 border border-yellow-400 hover:bg-yellow-400 transition-colors flex items-center justify-center cursor-pointer shadow-md hover:scale-110">
                <span className="text-[10px] text-yellow-900 font-bold leading-none select-none opacity-70 hover:opacity-100">−</span>
              </button>
              <button onClick={handleMaximize} className="w-4 h-4 rounded-full bg-green-500/90 border border-green-400 hover:bg-green-400 transition-colors flex items-center justify-center cursor-pointer shadow-md hover:scale-110">
                <span className="text-[10px] text-green-900 font-bold leading-none select-none opacity-70 hover:opacity-100">✱</span>
              </button>
            </div>

            {/* Centered title */}
            <div className="flex-1 flex justify-center items-center gap-2 text-os-text-primary absolute left-1/2 -translate-x-1/2">
              <span className="material-symbols-outlined text-[16px] text-os-text-muted" style={appIcon.filled ? { fontVariationSettings: "'FILL' 1" } : {}}>{appIcon.icon}</span>
              <span className="text-os-text text-[13px] font-medium tracking-wide">{title}</span>
            </div>

            {/* Spacer (w-16 right) */}
            <div className="w-16"></div>
          </div>

          {/* Window Content */}
          <div ref={windowRef} className="flex-1 overflow-hidden bg-os-bg-primary" style={{ position: 'relative' }}>
            {/* Phase 1.2.2 — visual flash for low-vision spacebar feedback (100ms) */}
            {isReading && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 9999,
                background: 'rgba(255,255,255,0.15)',
                pointerEvents: 'none', borderRadius: 2
              }} />
            )}
            <Suspense fallback={<AppLoader />}>
              {AppComponent ? (
                <AppComponent {...props} />
              ) : (
                <div className="flex items-center justify-center h-full text-os-text-secondary">
                  App not found: {app}
                </div>
              )}
            </Suspense>
          </div>
        </motion.div>
      </Rnd>
    </AnimatePresence>
  )
}

export default WindowFrame

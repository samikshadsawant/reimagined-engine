import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { speak } from '../hooks/useTTS'
import useOsStore from './osStore'

// Simple UUID generator (no external dependency)
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Apps that allow multiple instances
const MULTI_INSTANCE_APPS = ['Terminal', 'Notes', 'ImageViewer', 'PdfViewer']

const useWindowStore = create(
  immer((set, get) => ({
  windows: [],
  topZIndex: 100,

  openWindow: (app, title, defaultSize = { width: 800, height: 600 }, props = {}) => {
    try {
      const state = get()
      console.log(`[windowStore] openWindow called: app=${app}, title=${title}, defaultSize=${JSON.stringify(defaultSize)}`)

      // Validate app name
      if (!app || typeof app !== 'string') {
        console.error('[windowStore] Invalid app name:', app)
        return
      }

      // Check if app is already open (for single-instance apps)
      if (!MULTI_INSTANCE_APPS.includes(app)) {
        const existing = state.windows.find(w => w.app === app && !w.minimized)
        if (existing) {
          console.log('[windowStore] App already open, focusing:', app)
          get().focusWindow(existing.id)
          return
        }
      }

      // Create new window
      const id = generateId()
      const newZIndex = state.topZIndex + 1

      const newWindow = {
        id,
        app,
        title,
        x: 100 + (state.windows.length * 30),
        y: 100 + (state.windows.length * 30),
        width: defaultSize?.width || 800,
        height: defaultSize?.height || 600,
        zIndex: newZIndex,
        minimized: false,
        maximized: false,
        focused: true,
        props
      }

      console.log('[windowStore] Creating new window:', newWindow)

      // Set all other windows to not focused and update zIndex
      const updatedWindows = state.windows.map(w => ({
        ...w,
        focused: false
      }))

      set({
        windows: [...updatedWindows, newWindow],
        topZIndex: newZIndex
      })

      // Screen reader TTS announcement
      if (useOsStore.getState().ttsEnabled) {
        speak(`Opened ${title}`)
      }

      console.log('[windowStore] Window created successfully, total windows:', state.windows.length + 1)
    } catch (err) {
      console.error('[windowStore] openWindow error:', err)
    }
  },

  closeWindow: (id) => {
    try {
      const closing = get().windows.find(w => w.id === id)
      console.log('[windowStore] closeWindow called:', id)
      set((state) => ({
        windows: state.windows.filter(w => w.id !== id)
      }))
      // Screen reader TTS announcement
      if (closing && useOsStore.getState().ttsEnabled) {
        speak(`Closed ${closing.title}`)
      }
    } catch (err) {
      console.error('[windowStore] closeWindow error:', err)
    }
  },

  focusWindow: (id) => {
    set((state) => {
      const win = state.windows.find(w => w.id === id)
      if (!win) return state

      const newZIndex = state.topZIndex + 1

      return {
        topZIndex: newZIndex,
        windows: state.windows.map(w => ({
          ...w,
          focused: w.id === id,
          zIndex: w.id === id ? newZIndex : w.zIndex
        }))
      }
    })
  },

  minimizeWindow: (id) => {
    set((state) => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, minimized: true, focused: false } : w
      )
    }))
  },

  maximizeWindow: (id) => {
    set((state) => {
      const win = state.windows.find(w => w.id === id)
      if (!win) return state

      // If maximizing (not already maximized), save previous bounds
      if (!win.maximized) {
        return {
          topZIndex: state.topZIndex + 1,
          windows: state.windows.map(w =>
            w.id === id
              ? {
                  ...w,
                  maximized: true,
                  prevBounds: { x: w.x, y: w.y, width: w.width, height: w.height },
                  zIndex: state.topZIndex + 1,
                  focused: true
                }
              : { ...w, focused: false }
          )
        }
      } else {
        // If restoring from maximized, restore previous bounds
        return {
          topZIndex: state.topZIndex + 1,
          windows: state.windows.map(w =>
            w.id === id
              ? {
                  ...w,
                  maximized: false,
                  x: w.prevBounds?.x ?? 100,
                  y: w.prevBounds?.y ?? 100,
                  width: w.prevBounds?.width ?? 800,
                  height: w.prevBounds?.height ?? 600,
                  zIndex: state.topZIndex + 1,
                  focused: true
                }
              : { ...w, focused: false }
          )
        }
      }
    })
  },

  restoreWindow: (id) => {
    set((state) => {
      const win = state.windows.find(w => w.id === id)
      if (!win) return state

      const newZIndex = state.topZIndex + 1

      return {
        topZIndex: newZIndex,
        windows: state.windows.map(w => ({
          ...w,
          minimized: w.id === id ? false : w.minimized,
          focused: w.id === id,
          zIndex: w.id === id ? newZIndex : w.zIndex
        }))
      }
    })
  },

  updatePosition: (id, x, y) => {
    set((state) => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, x, y } : w
      )
    }))
  },

  updateSize: (id, width, height) => {
    set((state) => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, width: Math.max(300, width), height: Math.max(200, height) } : w
      )
    }))
  },

  closeAllWindows: () => {
    set({ windows: [] })
  },

  getWindowById: (id) => {
    return get().windows.find(w => w.id === id)
  },

  /**
   * Focus the next window in the list (for gesture swipe right)
   */
  focusNextWindow: () => {
    const state = get()
    const visible = state.windows.filter(w => !w.minimized)
    if (visible.length < 2) return
    const focusedIdx = visible.findIndex(w => w.focused)
    const nextIdx = (focusedIdx + 1) % visible.length
    const next = visible[nextIdx]
    if (next) {
      get().focusWindow(next.id)
      if (useOsStore.getState().ttsEnabled) {
        speak(`Switched to ${next.title}`)
      }
    }
  },

  /**
   * Focus the previous window in the list (for gesture swipe left)
   */
  focusPrevWindow: () => {
    const state = get()
    const visible = state.windows.filter(w => !w.minimized)
    if (visible.length < 2) return
    const focusedIdx = visible.findIndex(w => w.focused)
    const prevIdx = (focusedIdx - 1 + visible.length) % visible.length
    const prev = visible[prevIdx]
    if (prev) {
      get().focusWindow(prev.id)
      if (useOsStore.getState().ttsEnabled) {
        speak(`Switched to ${prev.title}`)
      }
    }
  }
})))

export default useWindowStore

export const useWindowById = (id) => useWindowStore(state => state.windows.find(w => w.id === id))
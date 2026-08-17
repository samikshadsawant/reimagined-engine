/**
 * Application Configuration
 * Centralized configuration for all app constants
 */

// ============================================================================
// APP INFO
// ============================================================================
export const APP_INFO = {
  name: 'SpiritOS',
  version: '1.0.0',
  storageKey: 'spiritos-storage'
}

// ============================================================================
// APPLICATION DEFINITIONS
// ============================================================================
export const APPS = {
  FileExplorer: {
    name: 'File Explorer',
    icon: '📁',
    defaultSize: { width: 900, height: 600 },
    color: '#3b82f6'
  },
  Terminal: {
    name: 'Terminal',
    icon: '💻',
    defaultSize: { width: 700, height: 450 },
    color: '#10b981'
  },
  Calculator: {
    name: 'Calculator',
    icon: '🧮',
    defaultSize: { width: 380, height: 480 },
    color: '#f59e0b'
  },
  Notes: {
    name: 'Notes',
    icon: '📝',
    defaultSize: { width: 600, height: 500 },
    color: '#8b5cf6'
  },
  Browser: {
    name: 'Browser',
    icon: '🌐',
    defaultSize: { width: 1000, height: 700 },
    color: '#06b6d4'
  },
  Settings: {
    name: 'Settings',
    icon: '⚙️',
    defaultSize: { width: 700, height: 550 },
    color: '#64748b'
  },
  Translator: {
    name: 'Translator',
    icon: '🌐',
    defaultSize: { width: 800, height: 550 },
    color: '#6366f1'
  },
  Presentation: {
    name: 'Presentation',
    icon: '🖼️',
    defaultSize: { width: 1000, height: 680 },
    color: '#7c3aed'
  },
  Reminders: {
    name: 'Reminders',
    icon: '⏰',
    defaultSize: { width: 720, height: 600 },
    color: '#f97316'
  },
  Emergency: {
    name: 'SOS Contacts',
    icon: '🆘',
    defaultSize: { width: 720, height: 600 },
    color: '#ef4444'
  },
  Vault: {
    name: 'Vault',
    icon: '🔐',
    defaultSize: { width: 480, height: 620 },
    color: '#6366f1'
  },
  PdfViewer: {
    name: 'PDF Viewer',
    icon: '📕',
    defaultSize: { width: 900, height: 700 },
    color: '#dc2626'
  },
  ImageViewer: {
    name: 'Image Viewer',
    icon: '🖼️',
    defaultSize: { width: 800, height: 600 },
    color: '#0ea5e9'
  }
}

// Desktop apps list (for icons grid)
export const DESKTOP_APPS = Object.entries(APPS)
  .filter(([key]) => key !== 'PdfViewer' && key !== 'ImageViewer')
  .map(([key, value]) => ({
    name: value.name,
    app: key,
    icon: value.icon
  }))

// Taskbar pinned apps
export const TASKBAR_APPS = [...DESKTOP_APPS]

// ============================================================================
// WINDOW CONFIGURATION
// ============================================================================
export const WINDOW_CONFIG = {
  minWidth: 300,
  minHeight: 200,
  defaultZIndex: 100,
  positionOffset: 30,
  borderRadius: 12,
  titleBarHeight: 32
}

// ============================================================================
// TASKBAR CONFIGURATION
// ============================================================================
export const TASKBAR_CONFIG = {
  height: 48,
  iconSize: 24,
  maxWindowButtons: 5,
  clockUpdateInterval: 1000
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================
export const NOTIFICATION_CONFIG = {
  duration: 5000,
  maxCount: 10,
  types: {
    info: { icon: 'ℹ️', color: '#3b82f6' },
    warn: { icon: '⚠️', color: '#f59e0b' },
    error: { icon: '❌', color: '#ef4444' },
    success: { icon: '✅', color: '#10b981' }
  }
}

// ============================================================================
// VOICE CONTROLLER
// ============================================================================
export const VOICE_CONFIG = {
  wakeWord: 'spirit',
  activeListeningTimeout: 5000,
  commands: {
    'open file explorer': { action: 'openApp', target: 'FileExplorer' },
    'open files': { action: 'openApp', target: 'FileExplorer' },
    'open calculator': { action: 'openApp', target: 'Calculator' },
    'open terminal': { action: 'openApp', target: 'Terminal' },
    'open notes': { action: 'openApp', target: 'Notes' },
    'open browser': { action: 'openApp', target: 'Browser' },
    'open settings': { action: 'openApp', target: 'Settings' },
    'close window': { action: 'closeApp' },
    'close': { action: 'closeApp' },
    'minimize window': { action: 'minimizeApp' },
    'minimize': { action: 'minimizeApp' },
    'maximize window': { action: 'maximizeApp' },
    'maximize': { action: 'maximizeApp' },
    'dark mode': { action: 'changeSetting', target: 'theme', value: 'dark' },
    'light mode': { action: 'changeSetting', target: 'theme', value: 'light' }
  }
}

// ============================================================================
// GESTURE CONTROLLER
// ============================================================================
export const GESTURE_ACTION_CONFIG = {
  holdTime: 800,
  cooldown: 2000,
  gestures: {
    THUMB_UP: { action: 'openApp', target: 'FileExplorer', label: 'Open App' },
    THUMB_DOWN: { action: 'closeApp', label: 'Close Window' },
    PEACE_SIGN: { action: 'openApp', target: 'Calculator', label: 'Open Calculator' },
    THREE_FINGERS: { action: 'openApp', target: 'FileExplorer', label: 'Open Files' },
    OPEN_PALM: { action: 'openApp', target: 'Browser', label: 'Open Browser' }
  }
}

// ============================================================================
// EYE TRACKER
// ============================================================================
export const EYE_TRACKER_CONFIG = {
  dwellTime: 1500,
  cursorSize: 16,
  smoothing: 0.05
}

// ============================================================================
// CONTEXT MENU
// ============================================================================
export const CONTEXT_MENU_ITEMS = [
  { label: 'Change Wallpaper', icon: '🖼️', action: 'wallpaper' },
  { label: 'New Folder', icon: '📁', action: 'newFolder' },
  { label: 'New File', icon: '📄', action: 'newFile' },
  { label: 'Open Terminal', icon: '💻', action: 'terminal' },
  { label: 'Refresh', icon: '🔄', action: 'refresh' }
]

// ============================================================================
// DESKTOP CONFIGURATION
// ============================================================================
export const DESKTOP_CONFIG = {
  iconGap: 8,
  iconSize: 80,
  gridColumns: 1
}

// ============================================================================
// ACCESSIBILITY PROFILE KEYS
// ============================================================================
export const PROFILES = ['default', 'elderly', 'visually-impaired', 'motor-impaired', 'beginner']

// Export helper to get app config
export const getAppConfig = (appName) => APPS[appName] || { name: appName, icon: '📄', defaultSize: { width: 800, height: 600 } }

// Export helper to get default window size
export const getDefaultSize = (appName) => APPS[appName]?.defaultSize || { width: 800, height: 600 }

// STEP 4 — Aladin-style squircle gradient colors per app
export const ICON_STYLES = {
  FileExplorer: { from: '#3b82f6', to: '#06b6d4', icon: '📁' },
  Terminal:     { from: '#374151', to: '#111827', icon: '⌨️' },
  Calculator:   { from: '#10b981', to: '#059669', icon: '⊞' },
  Notes:        { from: '#f59e0b', to: '#ef4444', icon: '✏️' },
  Browser:      { from: '#6366f1', to: '#3b82f6', icon: '◎' },
  Settings:     { from: '#64748b', to: '#475569', icon: '⚙' },
  Translator:   { from: '#8b5cf6', to: '#6366f1', icon: '⇄' },
  Mail:         { from: '#f43f5e', to: '#e11d48', icon: '✉' },
  KnownBook:    { from: '#f97316', to: '#ef4444', icon: '👤' },
  Presentation: { from: '#a855f7', to: '#7c3aed', icon: '🖼' },
  Reminders:    { from: '#fb923c', to: '#f97316', icon: '⏰' },
  Emergency:    { from: '#ef4444', to: '#b91c1c', icon: '🆘' },
  Vault:        { from: '#6366f1', to: '#4f46e5', icon: '🔐' },
  PdfViewer:    { from: '#dc2626', to: '#b91c1c', icon: '📕' },
  ImageViewer:  { from: '#0ea5e9', to: '#0284c7', icon: '🖼' },
}

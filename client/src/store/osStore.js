import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * @typedef {'default' | 'elderly' | 'visually-impaired' | 'motor-impaired' | 'beginner'} ProfileName
 * @typedef {'dark' | 'light'} Theme
 * @typedef {'normal' | 'large' | 'xl'} FontSize
 * @typedef {'normal' | 'medium' | 'bold'} FontWeight
 * @typedef {'normal' | 'high'} Contrast
 * @typedef {'normal' | 'large'} CursorSize
 */

/**
 * Profile presets configuration
 */
const PROFILE_PRESETS = {
  default: {
    fontSize: 'normal',
    contrast: 'normal',
    cursorSize: 'normal',
    theme: 'light',
    gestureEnabled: true,
    voiceEnabled: false,
    eyeTrackingEnabled: false,
    ttsEnabled: false,
    visualAlertsEnabled: false,
    animationsReduced: false,
    simplifiedUI: false,
    tooltipsEnabled: false,
    screenReaderHints: false,
    highContrast: false,
    largeTargets: false,
    dwellClick: false,
    keyboardOnly: false,
    stickyKeys: false,
    onboardingEnabled: false,
    contextualHelp: false
  },
  elderly: {
    fontSize: 'xl',
    contrast: 'high',
    cursorSize: 'large',
    theme: 'light',
    gestureEnabled: true,
    voiceEnabled: true,
    eyeTrackingEnabled: false,
    ttsEnabled: true,
    visualAlertsEnabled: false,
    animationsReduced: true,
    simplifiedUI: true,
    tooltipsEnabled: true,
    screenReaderHints: false,
    highContrast: false,
    largeTargets: true,
    dwellClick: false,
    keyboardOnly: false,
    stickyKeys: false,
    onboardingEnabled: false,
    contextualHelp: true
  },
  'visually-impaired': {
    fontSize: 'xl',
    contrast: 'high',
    cursorSize: 'large',
    theme: 'light',
    gestureEnabled: true,
    voiceEnabled: true,
    eyeTrackingEnabled: false,
    ttsEnabled: true,
    visualAlertsEnabled: true,
    animationsReduced: true,
    simplifiedUI: false,
    tooltipsEnabled: true,
    screenReaderHints: true,
    highContrast: true,
    largeTargets: true,
    dwellClick: true,
    keyboardOnly: false,
    stickyKeys: false,
    onboardingEnabled: false,
    contextualHelp: true
  },
  'motor-impaired': {
    fontSize: 'large',
    contrast: 'normal',
    cursorSize: 'large',
    theme: 'light',
    gestureEnabled: true,
    voiceEnabled: true,
    eyeTrackingEnabled: false,
    ttsEnabled: true,
    visualAlertsEnabled: false,
    animationsReduced: false,
    simplifiedUI: false,
    tooltipsEnabled: true,
    screenReaderHints: false,
    highContrast: false,
    largeTargets: true,
    dwellClick: true,
    keyboardOnly: false,
    stickyKeys: true,
    onboardingEnabled: false,
    contextualHelp: true
  },
  beginner: {
    fontSize: 'normal',
    contrast: 'normal',
    cursorSize: 'normal',
    theme: 'light',
    gestureEnabled: true,
    voiceEnabled: true,
    eyeTrackingEnabled: false,
    ttsEnabled: true,
    visualAlertsEnabled: false,
    animationsReduced: false,
    simplifiedUI: true,
    tooltipsEnabled: true,
    screenReaderHints: false,
    highContrast: false,
    largeTargets: false,
    dwellClick: false,
    keyboardOnly: false,
    stickyKeys: false,
    onboardingEnabled: true,
    contextualHelp: true
  }
}

/**
 * @typedef {Object} Notification
 * @property {string} id
 * @property {string} message
 * @property {'info' | 'warn' | 'error'} type
 * @property {number} timestamp
 */

const useOsStore = create(
  persist(
    (set, get) => ({
      // Theme & Appearance
      theme: 'light',
      wallpaper: 'linear-gradient(135deg, #eef0fb 0%, #dde1f9 50%, #e9e4f5 100%)',
      fontSize: 'normal',
      fontWeight: 'normal',
      contrast: 'normal',
      cursorSize: 'normal',

      // Accessibility
      profile: 'default',
      soundEnabled: true,

      // Input Methods
      gestureEnabled: false,
      voiceEnabled: false,
      eyeTrackingEnabled: false,
      // Gesture cursor movement (independent of gesture detection)
      gestureCursorEnabled: true,
      // Phase 1.1 — Sign Language
      signLanguageEnabled: false,
      // Phase 1.2 — Path Guidance
      pathGuidanceEnabled: false,

      // Presentation player active (for routing voice/gesture nav events)
      presentationActive: false,

      // Phase 6 — Interactive Reading face-depth zoom
      faceZoomScale: 1.0,

      // First-launch onboarding (auto-opens Welcome tour the very first time)
      firstLaunchDone: false,

      alzheimerPhase: 0,   // 0=disabled, 1–5=severity (Phase 2.5)
      userRole: 'user',    // 'user' | 'caregiver'

      // Phase 3.2 — Multilingual Voice
      voiceLocale: 'en-US',

      // Accessibility
      ttsEnabled: false,
      visualAlertsEnabled: false,

      // User Info
      userName: 'User',

      // Notifications
      /** @type {Notification[]} */
      notifications: [],

      // Actions
      setTheme: (/** @type {Theme} */ theme) => set({ theme }),
      setWallpaper: (/** @type {string} */ wallpaper) => set({ wallpaper }),
      setFontSize: (/** @type {FontSize} */ fontSize) => set({ fontSize }),
      setFontWeight: (/** @type {FontWeight} */ fontWeight) => set({ fontWeight }),
      setContrast: (/** @type {Contrast} */ contrast) => set({ contrast }),
      setCursorSize: (/** @type {CursorSize} */ cursorSize) => set({ cursorSize }),

      /**
       * Apply an accessibility profile preset
       * @param {ProfileName} profileName
       */
      applyProfile: (profileName) => {
        const preset = PROFILE_PRESETS[profileName]
        if (preset) {
          set({
            profile: profileName,
            fontSize: preset.fontSize,
            fontWeight: preset.fontWeight ?? 'normal',
            contrast: preset.contrast,
            cursorSize: preset.cursorSize,
            gestureEnabled: preset.gestureEnabled,
            voiceEnabled: preset.voiceEnabled,
            eyeTrackingEnabled: preset.eyeTrackingEnabled
          })
        }
      },

      toggleGesture: () => set((state) => ({ gestureEnabled: !state.gestureEnabled })),
      setGestureEnabled: (enabled) => set({ gestureEnabled: !!enabled }),
      toggleGestureCursor: () => set((state) => ({ gestureCursorEnabled: !state.gestureCursorEnabled })),
      setGestureCursorEnabled: (enabled) => set({ gestureCursorEnabled: !!enabled }),
      toggleVoice: () => set((state) => ({ voiceEnabled: !state.voiceEnabled })),
      setVoiceEnabled: (enabled) => set({ voiceEnabled: !!enabled }),
      toggleEyeTracking: () => set((state) => ({ eyeTrackingEnabled: !state.eyeTrackingEnabled })),
      setEyeTrackingEnabled: (enabled) => set({ eyeTrackingEnabled: !!enabled }),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      toggleTTS: () => set((state) => ({ ttsEnabled: !state.ttsEnabled })),
      setTTSEnabled: (enabled) => set({ ttsEnabled: !!enabled }),
      toggleVisualAlerts: () => set((state) => ({ visualAlertsEnabled: !state.visualAlertsEnabled })),
      setUserName: (/** @type {string} */ name) => set({ userName: name }),
      // Phase 1.1 — Sign Language toggle
      toggleSignLanguage: () => set((state) => ({ signLanguageEnabled: !state.signLanguageEnabled })),
      setSignLanguageEnabled: (enabled) => set({ signLanguageEnabled: !!enabled }),
      // Phase 1.2 — Path Guidance toggle
      togglePathGuidance: () => set((state) => ({ pathGuidanceEnabled: !state.pathGuidanceEnabled })),
      setPathGuidanceEnabled: (enabled) => set({ pathGuidanceEnabled: !!enabled }),

      // Presentation mode flag
      setPresentationActive: (v) => set({ presentationActive: !!v }),

      // Phase 6 — Face-depth zoom setter
      setFaceZoomScale: (scale) => set({ faceZoomScale: Math.max(0.6, Math.min(2.0, scale)) }),

      // First-launch
      markFirstLaunchDone: () => set({ firstLaunchDone: true }),

      setAlzheimerPhase: (phase) => set({ alzheimerPhase: Math.min(5, Math.max(0, phase)) }),
      setUserRole: (role) => set({ userRole: role }),
      // Phase 3.2 — Voice locale setter
      setVoiceLocale: (locale) => set({ voiceLocale: locale }),

      /**
       * Add a notification
       * @param {string} message
       * @param {'info' | 'warn' | 'error'} type
       */
      addNotification: (message, type = 'info') => {
        const id = Date.now().toString()
        set((state) => ({
          notifications: [...state.notifications, { id, message, type, timestamp: Date.now() }]
        }))

        // TTS: speak notification aloud if enabled
        if (get().ttsEnabled && window.speechSynthesis) {
          // Strip emoji for cleaner speech
          const cleanText = message.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/gu, '').trim()
          if (cleanText) {
            window.speechSynthesis.cancel()
            const utter = new SpeechSynthesisUtterance(cleanText)
            utter.rate = 1.1
            window.speechSynthesis.speak(utter)
          }
        }

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          get().dismissNotification(id)
        }, 5000)
      },

      /**
       * Dismiss a notification
       * @param {string} id
       */
      dismissNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id)
        }))
      },

      clearNotifications: () => set({ notifications: [] })
    }),
    {
      name: 'spiritos-storage',
      version: 5,
      migrate(persisted, fromVersion) {
        // v0–v4: normalize theme to a valid value, default to 'light'
        if (!persisted.state) persisted.state = {}
        if (!['dark', 'light'].includes(persisted.state.theme)) {
          persisted.state.theme = 'light'
        }
        return persisted
      },
      partialize: (state) => ({
        theme: state.theme,
        wallpaper: state.wallpaper,
        fontSize: state.fontSize,
        fontWeight: state.fontWeight,
        contrast: state.contrast,
        cursorSize: state.cursorSize,
        profile: state.profile,
        userName: state.userName,
        signLanguageEnabled: state.signLanguageEnabled,
        pathGuidanceEnabled: state.pathGuidanceEnabled,
        alzheimerPhase: state.alzheimerPhase,
        userRole: state.userRole,
        voiceLocale: state.voiceLocale,
        gestureEnabled: state.gestureEnabled,
        gestureCursorEnabled: state.gestureCursorEnabled,
        voiceEnabled: state.voiceEnabled,
        eyeTrackingEnabled: state.eyeTrackingEnabled,
        ttsEnabled: state.ttsEnabled,
        visualAlertsEnabled: state.visualAlertsEnabled,
        firstLaunchDone: state.firstLaunchDone,
      })
    }
  )
)

export default useOsStore
export { PROFILE_PRESETS }

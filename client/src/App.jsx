import React, { useEffect, useState } from 'react'
import Desktop from './desktop/Desktop'
import BootScreen from './desktop/BootScreen'
import VoiceController from './input/VoiceController'
import GestureController from './input/GestureController'
import SignLanguageController from './input/SignLanguageController' // Phase 1.1.5
import FaceRecognition from './input/FaceRecognition'              // Phase 2.4
import EyeTracker from './input/EyeTracker'                        // Phase 1.2
import VisualAlert from './components/VisualAlert'
import { ToastContainer } from './components/Toast'
import SOSButton from './desktop/SOSButton'
import HelpButton from './desktop/HelpButton'
import useOsStore from './store/osStore'
import useWindowStore from './store/windowStore'
import useAlzheimerSupport from './hooks/useAlzheimerSupport'       // Phase 2.5
import useAccessibility from './hooks/useAccessibility'            // Theme & font size
import useReminderScheduler from './hooks/useReminderScheduler'    // Reminders fire-on-time
import { getDefaultSize } from './config/appConfig'
import axios from 'axios'

function App() {
  // Apply theme and accessibility settings
  useAccessibility()
  // Run the reminder scheduler at app level so reminders fire even when the
  // Reminders window is closed.
  useReminderScheduler()

  const {
    gestureEnabled, voiceEnabled, signLanguageEnabled, eyeTrackingEnabled,
    alzheimerPhase = 0,
    firstLaunchDone, markFirstLaunchDone
  } = useOsStore()
  const openWindow = useWindowStore((s) => s.openWindow)
  const [booted, setBooted] = useState(false)

  // Clear stale localStorage on first load to force input features OFF
  useEffect(() => {
    const stored = localStorage.getItem('spiritos-storage')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // If old format without version, clear it
        if (parsed.state?.gestureEnabled !== undefined) {
          delete parsed.state.gestureEnabled
          delete parsed.state.voiceEnabled
          delete parsed.state.eyeTrackingEnabled
          localStorage.setItem('spiritos-storage', JSON.stringify(parsed))
        }
      } catch (e) {
        // ignore
      }
    }
  }, [])

  // Phase 2.5 — Alzheimer support hook (reminders, face scan trigger, unknown prompt)
  useAlzheimerSupport(alzheimerPhase)

  // First-launch onboarding: open the Welcome deck once after boot completes.
  useEffect(() => {
    if (!booted || firstLaunchDone) return
    const timer = setTimeout(async () => {
      try {
        const r = await axios.get('/api/presentations')
        const welcome = (r.data || []).find((d) => d.isBuiltin && /welcome/i.test(d.title))
        if (welcome) {
          openWindow('Presentation', 'Welcome tour',
            getDefaultSize('Presentation'),
            { initialDeckId: welcome.id })
        }
      } catch (_) {
        // Presentations API down — fall back to opening the library
        openWindow('Presentation', 'Presentations', getDefaultSize('Presentation'))
      }
      markFirstLaunchDone()
    }, 1200)
    return () => clearTimeout(timer)
  }, [booted, firstLaunchDone, markFirstLaunchDone, openWindow])

  return (
    <div className="w-screen h-screen overflow-hidden bg-os-bg-primary">
      {/* Startup boot screen — plays Awake.mp3 on every load */}
      {!booted && <BootScreen onDone={() => setBooted(true)} />}
      <Desktop />
      {/* Voice controller — real speech recognition with 30+ commands */}
      {voiceEnabled && <VoiceController />}
      {/* Gesture/camera only activates when user clicks the toggle button */}
      {gestureEnabled && <GestureController />}
      {/* Sign language overlay — Phase 1.1.5 */}
      {signLanguageEnabled && <SignLanguageController />}
      {/* Eye tracking cursor control — Phase 1.2 */}
      {eyeTrackingEnabled && <EyeTracker />}
      {/* Face recognition — Phase 2.4/2.5: active when Alzheimer phase >= 3 */}
      {alzheimerPhase >= 3 && (
        <div style={{
          position: 'fixed', bottom: 16, right: 16,
          zIndex: 9990, borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 4px 32px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <FaceRecognition enabled={true} />
        </div>
      )}
      {/* Visual alert overlay for hearing-impaired users */}
      <VisualAlert />
      {/* Toast notifications */}
      <ToastContainer />
      {/* Always-visible accessibility helpers */}
      {booted && <HelpButton />}
      {booted && <SOSButton />}
    </div>
  )

}

export default App


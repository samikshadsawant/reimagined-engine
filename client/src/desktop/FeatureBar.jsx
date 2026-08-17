import React from 'react'
import { motion } from 'framer-motion'
import useOsStore from '../store/osStore'

const FEATURE_BTNS = [
  { key: 'gestureEnabled',      toggle: 'toggleGesture',      icon: 'gesture',             label: 'Gesture' },
  { key: 'voiceEnabled',        toggle: 'toggleVoice',        icon: 'mic',                 label: 'Voice'   },
  { key: 'eyeTrackingEnabled',  toggle: 'toggleEyeTracking',  icon: 'visibility',          label: 'Eye'     },
  { key: 'ttsEnabled',          toggle: 'toggleTTS',          icon: 'record_voice_over',   label: 'TTS'     },
  { key: 'visualAlertsEnabled', toggle: 'toggleVisualAlerts', icon: 'notifications',       label: 'Alerts'  },
]

function FeatureBar() {
  const store = useOsStore()

  return (
    <div className="fixed top-14 left-5 z-[10000] flex flex-col gap-1.5 pointer-events-auto">
      {FEATURE_BTNS.map(({ key, toggle, icon, label }) => {
        const active = store[key]
        return (
          <motion.button
            key={key}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={store[toggle]}
            title={label}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-sm ${
              active
                ? 'bg-os-accent text-white shadow-glow'
                : 'glass-panel text-os-text-muted hover:text-os-text'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{icon}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

export default FeatureBar

/**
 * useTTS — Text-to-Speech hook for SpiritOS
 *
 * Wraps the browser's Web Speech Synthesis API.
 * - `speak(text)` queues a spoken utterance
 * - `announce(text)` is a convenience wrapper that only fires when TTS is enabled
 * - `cancel()` stops any active speech
 *
 * The hook reads `ttsEnabled` from osStore and is a no-op when disabled.
 */

import { useCallback, useRef } from 'react'
import useOsStore from '../store/osStore'

// ---- standalone helpers (usable outside React) ---- //

/**
 * Speak text immediately using the browser Speech Synthesis API.
 * Safe to call even if the API is unavailable.
 */
export function speak(text, { rate = 1.0, pitch = 1.0, volume = 1.0 } = {}) {
  if (!window.speechSynthesis) return
  // Cancel any ongoing speech so announcements don't queue up
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = rate
  utterance.pitch = pitch
  utterance.volume = volume

  // Prefer a natural-sounding English voice when available
  const voices = window.speechSynthesis.getVoices()
  const preferred = voices.find(
    (v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('natural')
  ) || voices.find((v) => v.lang.startsWith('en'))
  if (preferred) utterance.voice = preferred

  window.speechSynthesis.speak(utterance)
}

/** Stop any active speech. */
export function cancelSpeech() {
  if (window.speechSynthesis) window.speechSynthesis.cancel()
}

// ---- React hook ---- //

export default function useTTS() {
  const ttsEnabled = useOsStore((s) => s.ttsEnabled)
  const lastSpoken = useRef('')
  const lastSpokeAt = useRef(0)

  /**
   * Announce text aloud if TTS is enabled.
   * De-duplicates identical messages within 2 seconds.
   */
  const announce = useCallback(
    (text, opts = {}) => {
      if (!ttsEnabled) return
      if (!text) return

      // De-duplicate rapid-fire identical announcements
      const now = Date.now()
      if (text === lastSpoken.current && now - lastSpokeAt.current < 2000) return
      lastSpoken.current = text
      lastSpokeAt.current = now

      speak(text, opts)
    },
    [ttsEnabled]
  )

  /** Cancel any active speech. */
  const cancel = useCallback(() => {
    cancelSpeech()
  }, [])

  return { announce, cancel, speak, ttsEnabled }
}

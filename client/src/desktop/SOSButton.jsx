/**
 * SOSButton — global emergency pill plus a 5-second cancellable countdown.
 *
 * Press flow:
 *   1. User taps the SOS pill.
 *   2. A full-screen red overlay appears with a 5-second countdown and a
 *      large "Cancel" button. This protects against accidental presses.
 *   3. On expiry, SpiritOS:
 *        - speaks "Calling <Primary Name>"
 *        - opens the OS dialer via `tel:` (mobile / Windows phone link)
 *        - copies the phone number to the clipboard as a desktop fallback
 *        - announces the user's location if the browser allows geolocation
 *   4. Long-press (1.5 s) on the pill opens the SOS Contacts editor.
 *
 * Refreshes the contact list every 60 s so newly added contacts work without
 * a reload.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import useWindowStore from '../store/windowStore'
import useOsStore from '../store/osStore'
import { getDefaultSize } from '../config/appConfig'
import { speak } from '../hooks/useTTS'

const REFRESH_INTERVAL_MS = 60_000
const LONG_PRESS_MS       = 1500
const COUNTDOWN_SECONDS   = 5

// ── Countdown overlay ────────────────────────────────────────────────────────
function CountdownOverlay({ contact, onCancel, onConfirm }) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS)

  useEffect(() => {
    if (secondsLeft <= 0) {
      onConfirm()
      return
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft, onConfirm])

  // Speak countdown so blind users know the timer is running
  useEffect(() => {
    if (secondsLeft === COUNTDOWN_SECONDS) {
      speak(`Calling ${contact.name} in ${secondsLeft} seconds. Tap cancel to stop.`)
    }
  }, [contact.name, secondsLeft])

  return (
    <div className="fixed inset-0 z-[100001] flex flex-col items-center justify-center"
         style={{ background: 'rgba(220, 38, 38, 0.95)' }}>
      <div className="text-center text-white max-w-md px-6">
        <div className="w-32 h-32 mx-auto rounded-full border-8 border-white/40 flex items-center justify-center mb-6 animate-pulse">
          <span className="text-7xl tabular-nums font-bold">{secondsLeft}</span>
        </div>
        <h2 className="text-3xl font-semibold">Calling {contact.name}</h2>
        <p className="text-white/80 mt-2">{contact.phone}</p>
        {contact.relationship && (
          <p className="text-white/70 text-sm mt-1">{contact.relationship}</p>
        )}
        <p className="mt-6 text-sm text-white/70">
          You can stop this in {secondsLeft} second{secondsLeft === 1 ? '' : 's'}.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            onClick={onCancel}
            className="w-full max-w-xs px-6 py-4 rounded-2xl bg-white text-red-600 font-bold text-lg shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="w-full max-w-xs px-6 py-3 rounded-2xl bg-red-700 text-white font-medium border border-white/20 hover:bg-red-800 transition-colors"
          >
            Call now
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main button ──────────────────────────────────────────────────────────────
export default function SOSButton() {
  const [contacts, setContacts]   = useState([])
  const [countdown, setCountdown] = useState(null) // contact obj while counting down
  const longPressTimer = useRef(null)
  const heldRef        = useRef(false)
  const openWindow     = useWindowStore((s) => s.openWindow)
  const addNotification = useOsStore((s) => s.addNotification)

  const fetchContacts = useCallback(async () => {
    try {
      const r = await axios.get('/api/emergency')
      setContacts(r.data || [])
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[SOS] fetch failed:', err?.message)
      }
    }
  }, [])

  useEffect(() => {
    fetchContacts()
    const t = setInterval(fetchContacts, REFRESH_INTERVAL_MS)
    return () => clearInterval(t)
  }, [fetchContacts])

  const openEmergencyApp = useCallback(() => {
    openWindow('Emergency', 'SOS Contacts', getDefaultSize('Emergency'))
  }, [openWindow])

  // Try to attach a "current location" string to the SOS notification.
  // We do not block the call — geolocation just enriches the message if it
  // resolves quickly.
  const tryGeolocate = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(5)
          const lng = pos.coords.longitude.toFixed(5)
          resolve(`https://maps.google.com/?q=${lat},${lng}`)
        },
        () => resolve(null),
        { timeout: 4000, maximumAge: 60_000 }
      )
    })

  const startCountdown = () => {
    if (contacts.length === 0) {
      addNotification('Please add an emergency contact first.', 'warn')
      openEmergencyApp()
      return
    }
    setCountdown(contacts[0])
  }

  const cancelCountdown = () => {
    setCountdown(null)
    speak('Call cancelled.')
    addNotification('🆘 SOS cancelled', 'info')
  }

  const confirmCall = async () => {
    const target = countdown
    setCountdown(null)
    if (!target) return

    speak(`Calling ${target.name}.`)
    addNotification(`🆘 Calling ${target.name} (${target.phone})`, 'warn')

    // Try clipboard so desktop browsers without tel: can paste into a phone
    try {
      if (navigator.clipboard) {
        const locUrl = await tryGeolocate()
        const message = locUrl
          ? `${target.phone}  · location: ${locUrl}`
          : target.phone
        await navigator.clipboard.writeText(message)
        addNotification('📋 Phone number copied to clipboard', 'info')
      }
    } catch (_) {}

    try {
      window.location.href = `tel:${target.phone.replace(/\s+/g, '')}`
    } catch (_) {}
  }

  // Long-press to edit, short tap to start countdown
  const handlePointerDown = () => {
    heldRef.current = false
    longPressTimer.current = setTimeout(() => {
      heldRef.current = true
      openEmergencyApp()
    }, LONG_PRESS_MS)
  }
  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (!heldRef.current) startCountdown()
  }
  const handlePointerLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // Voice command bridge: "call for help" / "sos" routes through here
  useEffect(() => {
    const handler = () => startCountdown()
    window.addEventListener('spiritos:sos', handler)
    return () => window.removeEventListener('spiritos:sos', handler)
  }, [contacts])

  const label = contacts.length > 0
    ? `Call ${contacts[0].name}`
    : 'Set up SOS'

  return (
    <>
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        title="Press for emergency · hold to edit contacts"
        aria-label="Emergency SOS button"
        className="fixed bottom-24 left-5 z-[10500] flex items-center gap-2 px-5 py-3
                   rounded-full bg-red-600 text-white font-semibold shadow-lg
                   border-2 border-red-300/60 hover:bg-red-500 active:scale-[0.97] transition-all"
        style={{ minHeight: 56 }}
      >
        <span className="material-symbols-outlined text-[22px]">sos</span>
        <span className="text-[15px]">{label}</span>
      </button>

      {countdown && (
        <CountdownOverlay
          contact={countdown}
          onCancel={cancelCountdown}
          onConfirm={confirmCall}
        />
      )}
    </>
  )
}

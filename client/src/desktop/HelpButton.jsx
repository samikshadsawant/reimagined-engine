/**
 * HelpButton — round purple pill that opens the Welcome presentation.
 *
 * On mount, pulls the list of presentations from the backend and stores
 * the id of the "Welcome to SpiritOS" deck. Pressing the button opens the
 * Presentation app pre-pointed at that deck.
 *
 * If the welcome deck cannot be found, the button still opens the
 * Presentation library so the user can pick something.
 */

import React, { useEffect, useState } from 'react'
import axios from 'axios'
import useWindowStore from '../store/windowStore'
import { getDefaultSize } from '../config/appConfig'

export default function HelpButton() {
  const [welcomeId, setWelcomeId] = useState(null)
  const openWindow = useWindowStore((s) => s.openWindow)

  useEffect(() => {
    let cancelled = false
    axios.get('/api/presentations')
      .then((r) => {
        if (cancelled) return
        const list = r.data || []
        // Prefer the builtin welcome deck; fall back to first builtin.
        const welcome = list.find((d) => d.isBuiltin && /welcome/i.test(d.title))
                     || list.find((d) => d.isBuiltin)
        if (welcome) setWelcomeId(welcome.id)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const openHelp = () => {
    openWindow('Presentation', 'Welcome tour',
      getDefaultSize('Presentation'),
      welcomeId ? { initialDeckId: welcomeId } : {})
  }

  return (
    <button
      onClick={openHelp}
      aria-label="Open Welcome help tour"
      title="Open Welcome tour"
      className="fixed bottom-24 left-44 z-[10500] flex items-center gap-2 px-4 py-3
                 rounded-full bg-os-accent text-white font-semibold shadow-glow
                 hover:opacity-90 transition-all"
      style={{ minHeight: 56 }}
    >
      <span className="material-symbols-outlined text-[22px]">help</span>
      <span className="text-[14px]">Help me</span>
    </button>
  )
}

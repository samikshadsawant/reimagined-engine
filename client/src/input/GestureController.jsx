/**
 * GestureController — clean rewrite.
 *
 * Pipeline (one path, no branching):
 *   webcam → MediaPipe Hands → 21 landmarks → classifier → action
 *
 * What the user sees:
 *   • A purple cursor follows the index finger on every frame.
 *   • Pinch (thumb-index touch) clicks the element under the cursor.
 *   • Other gestures are buffered through a 3-frame majority vote, then a
 *     hold timer, then the action runs once.
 *   • A small mirrored camera preview at top-left, draggable out of the way.
 *
 * Gestures (from a single camera, no calibration):
 *   👆 Index up        → cursor only
 *   👌 Pinch           → click
 *   🖐 Open palm       → open Notes
 *   👍 Thumb up        → open File Explorer
 *   👎 Thumb down      → close active window
 *   ✌️ Peace           → open Calculator
 *   🤟 Three fingers   → open Translator
 *   ✊ Fist            → right click
 *   👋 Swipe →/←       → next / previous window  (or slide nav while
 *                         a presentation is open)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import useOsStore from '../store/osStore'
import useWindowStore from '../store/windowStore'
import { GESTURE_TIMING_CONFIG, APP_DEFAULTS } from '../config/gestureConfig'
import { acquireCamera, releaseCamera } from './sharedCamera'

const CONFIG = GESTURE_TIMING_CONFIG

// ── Constants ─────────────────────────────────────────────────────────────────
const PINCH_THRESH = 0.38       // pinch_ratio < this  → pinch (tighter than before)
const SWIPE_DX     = 0.25       // normalised wrist X distance over 8 frames
const SWIPE_MS     = 500
const HOLD_MS      = 400        // hold time before non-pinch gestures fire
const VOTE_MIN     = 2          // frames out of last 5 needed to consider gesture stable

// Helpers
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const lerp = (a, b, t) => (a == null ? b : a + (b - a) * t)

// ── Classifier ───────────────────────────────────────────────────────────────
// Uses MediaPipe 21-landmark hand model.
// Key insight: measure everything relative to palm size (index MCP → pinky MCP
// distance) so the classifier is distance-invariant.
//
// Landmark indices:
//   0  WRIST
//   1  THUMB_CMC  2  THUMB_MCP  3  THUMB_IP   4  THUMB_TIP
//   5  INDEX_MCP  6  INDEX_PIP  7  INDEX_DIP   8  INDEX_TIP
//   9  MIDDLE_MCP 10 MIDDLE_PIP 11 MIDDLE_DIP  12 MIDDLE_TIP
//   13 RING_MCP   14 RING_PIP   15 RING_DIP    16 RING_TIP
//   17 PINKY_MCP  18 PINKY_PIP  19 PINKY_DIP   20 PINKY_TIP
function classify(landmarks) {
  if (!landmarks || landmarks.length < 21) return { gesture: null, features: null }

  const lm = landmarks   // shorthand

  // Key points
  const wrist    = lm[0]
  const thumbCmc = lm[1]
  const thumbMcp = lm[2]
  const thumbTip = lm[4]
  const idxMcp   = lm[5]
  const idxPip   = lm[6]
  const idxTip   = lm[8]
  const midMcp   = lm[9]
  const midPip   = lm[10]
  const midTip   = lm[12]
  const ringPip  = lm[14]
  const ringTip  = lm[16]
  const pinkyMcp = lm[17]
  const pinkyPip = lm[18]
  const pinkyTip = lm[20]

  // ── Palm scale: index MCP → pinky MCP (stable, rotation-independent) ──────
  const palm = dist(idxMcp, pinkyMcp) + 1e-3

  // ── Finger extended check ─────────────────────────────────────────────────
  // A finger is extended when its tip is further from the wrist than its PIP.
  // This is rotation-independent unlike pure Y comparison.
  // We add a 15% palm-relative dead-zone to avoid counting slightly bent fingers.
  const fingerExt = (tip, pip) =>
    dist(tip, wrist) > dist(pip, wrist) + palm * 0.15

  const idxExt   = fingerExt(idxTip,   idxPip)
  const midExt   = fingerExt(midTip,   midPip)
  const ringExt  = fingerExt(ringTip,  ringPip)
  const pinkyExt = fingerExt(pinkyTip, pinkyPip)

  // ── Thumb extension ───────────────────────────────────────────────────────
  // Thumb is extended when thumb tip is far from index MCP (away from palm).
  // Use thumb IP → thumb MCP direction projected onto palm plane instead of
  // raw Y so it works at any hand orientation.
  const thumbExtRatio  = dist(thumbTip, idxMcp) / palm   // > 1.1 → extended
  const thumbExt       = thumbExtRatio > 1.1

  // ── Pinch ─────────────────────────────────────────────────────────────────
  // Thumb tip close to index tip, regardless of other fingers.
  // Use a tighter normalised threshold than before.
  const pinchDist  = dist(thumbTip, idxTip) / palm

  // ── Thumb up / down ───────────────────────────────────────────────────────
  // Only valid when all 4 fingers are curled (not extended).
  // Thumb up:   thumb tip is above (lower Y) the thumb MCP by > 1 palm width
  // Thumb down: thumb tip is below (higher Y) the thumb MCP by > 1 palm width
  // Using MCP as anchor (not wrist) so tilting the hand doesn't misfire.
  const allFingersCurled = !idxExt && !midExt && !ringExt && !pinkyExt
  const thumbUpRaw    = thumbTip.y < thumbMcp.y - palm * 0.8
  const thumbDownRaw  = thumbTip.y > thumbMcp.y + palm * 0.8

  const features = {
    valid: true,
    indexTip: idxTip,
    wrist,
    pinchDist,
    extCount: [idxExt, midExt, ringExt, pinkyExt].filter(Boolean).length
  }

  // ── Classification order: most specific → least specific ─────────────────

  // 1. PINCH — thumb touches index tip (strongest signal, check first)
  //    Don't require idxExt here — during pinch the index is naturally bent.
  //    But require that middle/ring/pinky are NOT all extended (would be open_palm).
  if (pinchDist < PINCH_THRESH) {
    return { gesture: 'pinch', features }
  }

  // 2. THUMB UP / DOWN — all other fingers curled, thumb clearly up or down
  //    Extra guard: thumb tip must NOT be close to index tip (already caught above)
  if (allFingersCurled && thumbExt) {
    if (thumbUpRaw)   return { gesture: 'thumb_up',   features }
    if (thumbDownRaw) return { gesture: 'thumb_down', features }
  }

  // 3. OPEN PALM — all 4 fingers extended + thumb extended
  if (idxExt && midExt && ringExt && pinkyExt && thumbExt) {
    return { gesture: 'open_palm', features }
  }

  // 4. THREE FINGERS — index + middle + ring extended, pinky curled
  if (idxExt && midExt && ringExt && !pinkyExt) {
    return { gesture: 'three', features }
  }

  // 5. PEACE — index + middle extended, ring + pinky curled
  if (idxExt && midExt && !ringExt && !pinkyExt) {
    return { gesture: 'peace', features }
  }

  // 6. POINT — only index extended
  if (idxExt && !midExt && !ringExt && !pinkyExt) {
    return { gesture: 'point', features }
  }

  // 7. FIST — no fingers extended (thumb state doesn't matter)
  if (!idxExt && !midExt && !ringExt && !pinkyExt && !thumbExt) {
    return { gesture: 'fist', features }
  }

  return { gesture: null, features }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function GestureController() {
  const {
    gestureEnabled, setGestureEnabled,
    gestureCursorEnabled, toggleGestureCursor,
    addNotification
  } = useOsStore()

  // UI state for status banner only (cursor moves directly via DOM ref)
  const [status, setStatus]           = useState('idle') // idle | loading | ready | error
  const [error, setError]             = useState(null)
  const [currentGesture, setGesture]  = useState(null)

  // Refs that don't need to trigger re-renders
  const videoRef       = useRef(null)
  const previewRef     = useRef(null)   // small visible preview <video>
  const cursorRef      = useRef(null)
  const handsRef       = useRef(null)
  const animRef        = useRef(null)
  const streamRef      = useRef(null)
  const hadCameraRef   = useRef(false)
  const cooldownsRef   = useRef({})
  const histRef        = useRef([])      // last 5 classifier outputs
  const swipeTrackRef  = useRef([])      // [{x,t}, ...] last 8 wrist samples
  const cursorPosRef   = useRef(null)
  const lastFiredRef    = useRef(null)    // gesture name we just fired
  const lastFiredAtRef  = useRef(0)       // timestamp when lastFiredRef was set
  const holdTimerRef    = useRef(null)    // pending hold timer id
  const holdGestureRef  = useRef(null)    // gesture the pending hold is for
  // Stable ref wrapper so MediaPipe never needs to re-register its callback
  const onResultsRef    = useRef(null)
  // Track last pinch target + time for double-click detection
  const lastPinchTargetRef = useRef(null)
  const lastPinchTimeRef   = useRef(0)

  // ── Cooldown helper ────────────────────────────────────────────────────────
  const ready = useCallback((key, ms) => {
    const last = cooldownsRef.current[key] || 0
    if (Date.now() - last >= ms) {
      cooldownsRef.current[key] = Date.now()
      return true
    }
    return false
  }, [])

  // ── Cursor + click helpers ─────────────────────────────────────────────────
  // Move the on-screen cursor to viewport (vx, vy).
  const moveCursor = useCallback((vx, vy) => {
    cursorPosRef.current = { x: vx, y: vy }
    const el = cursorRef.current
    if (!el) return
    el.style.transform = `translate3d(${vx - 14}px, ${vy - 14}px, 0)`
    el.style.opacity = '1'
  }, [])

  // Update cursor from MediaPipe normalised landmark.
  // The webcam image is mirrored for the user, so we flip X here so a hand
  // moving to the user's right moves the cursor right on the screen.
  // We also stretch the central portion of the camera frame to the full
  // viewport so users don't need to reach the camera edges.
  const cursorFromLandmark = useCallback((p) => {
    if (!p) return
    const PAD = 0.18
    const usable = 1 - 2 * PAD
    const fx = Math.max(0, Math.min(1, (p.x - PAD) / usable))
    const fy = Math.max(0, Math.min(1, (p.y - PAD) / usable))
    const vx = (1 - fx) * window.innerWidth
    const vy = fy        * window.innerHeight

    const prev = cursorPosRef.current
    const sx = lerp(prev?.x, vx, CONFIG.MOUSE_SMOOTHING)
    const sy = lerp(prev?.y, vy, CONFIG.MOUSE_SMOOTHING)
    moveCursor(sx, sy)
  }, [moveCursor])

  const hideCursor = useCallback(() => {
    if (cursorRef.current) cursorRef.current.style.opacity = '0'
  }, [])

  // Click element at the current cursor position. Pulses the cursor for
  // visual feedback. Skips the cursor element itself.
  // Dispatches the full pointer + mouse + click sequence so Framer Motion
  // and React synthetic events both fire reliably.
  const clickAtCursor = useCallback((button = 'left') => {
    const pos = cursorPosRef.current
    if (!pos) return
    let target = document.elementFromPoint(pos.x, pos.y)
    if (!target || target === cursorRef.current) return
    // Walk up if we hit a non-interactive wrapper
    while (target && target !== document.body && getComputedStyle(target).pointerEvents === 'none') {
      target = target.parentElement
    }
    if (!target) return

    cursorRef.current?.classList.add('gc-pulse')
    setTimeout(() => cursorRef.current?.classList.remove('gc-pulse'), 220)

    const isRight = button === 'right'
    const btnNum  = isRight ? 2 : 0
    const init    = {
      bubbles: true, cancelable: true, view: window,
      clientX: pos.x, clientY: pos.y,
      screenX: pos.x, screenY: pos.y,
      button: btnNum, buttons: isRight ? 2 : 1,
      pointerId: 1, pointerType: 'mouse', isPrimary: true,
      pressure: 0.5
    }

    try {
      // Full sequence: pointer events (Framer Motion) + mouse events (React)
      target.dispatchEvent(new PointerEvent('pointerover',  { ...init, pressure: 0 }))
      target.dispatchEvent(new PointerEvent('pointerenter', { ...init, pressure: 0, bubbles: false }))
      target.dispatchEvent(new PointerEvent('pointerdown',  init))
      target.dispatchEvent(new MouseEvent('mousedown',      init))
      target.dispatchEvent(new PointerEvent('pointerup',    init))
      target.dispatchEvent(new MouseEvent('mouseup',        init))
      if (isRight) {
        target.dispatchEvent(new MouseEvent('contextmenu', init))
      } else {
        target.dispatchEvent(new MouseEvent('click', init))
        target.dispatchEvent(new PointerEvent('pointerout',   { ...init, pressure: 0 }))
        target.dispatchEvent(new PointerEvent('pointerleave', { ...init, pressure: 0, bubbles: false }))
      }
      if (typeof target.focus === 'function') target.focus({ preventScroll: true })
    } catch (err) {
      console.warn('[Gesture] click dispatch failed:', err.message)
    }
  }, [])

  // ── Action map ─────────────────────────────────────────────────────────────
  // Reads everything from store snapshots so this callback never goes stale
  // and never forces onResults / MediaPipe to restart.
  const runAction = useCallback((gesture) => {
    const { addNotification: notify, presentationActive } = useOsStore.getState()
    const { openWindow, closeWindow, focusNextWindow, focusPrevWindow, windows } = useWindowStore.getState()

    // While a presentation is on screen, gestures drive slide nav
    if (presentationActive) {
      if (gesture === 'thumb_up' || gesture === 'open_palm' || gesture === 'peace') {
        if (ready('pres_next', 800)) {
          window.dispatchEvent(new CustomEvent('spiritos:presentation', { detail: { cmd: 'next' } }))
        }
        return
      }
      if (gesture === 'thumb_down') {
        if (ready('pres_close', 800)) {
          window.dispatchEvent(new CustomEvent('spiritos:presentation', { detail: { cmd: 'close' } }))
        }
        return
      }
      if (gesture === 'three') {
        if (ready('pres_read', 1500)) {
          window.dispatchEvent(new CustomEvent('spiritos:presentation', { detail: { cmd: 'read' } }))
        }
        return
      }
    }

    switch (gesture) {
      case 'thumb_up':
        console.log('[Gesture] firing thumb_up → FileExplorer')
        openWindow('FileExplorer', 'File Explorer', APP_DEFAULTS.FileExplorer)
        notify('👍 File Explorer', 'info')
        break
      case 'thumb_down': {
        console.log('[Gesture] firing thumb_down → close window')
        const focused = windows.find((w) => w.focused)
        if (focused) {
          closeWindow(focused.id)
          notify('👎 Closed window', 'info')
        }
        break
      }
      case 'peace':
        console.log('[Gesture] firing peace → Calculator')
        openWindow('Calculator', 'Calculator', APP_DEFAULTS.Calculator)
        notify('✌️ Calculator', 'info')
        break
      case 'three':
        console.log('[Gesture] firing three → Translator')
        openWindow('Translator', 'Translator', APP_DEFAULTS.Translator || { width: 800, height: 550 })
        notify('🤟 Translator', 'info')
        break
      case 'open_palm':
        console.log('[Gesture] firing open_palm → Notes')
        openWindow('Notes', 'Notes', APP_DEFAULTS.Notes)
        notify('🖐 Notes', 'info')
        break
      case 'fist':
        console.log('[Gesture] firing fist → right-click')
        clickAtCursor('right')
        notify('✊ Right-click', 'info')
        break
      case 'swipe_right':
        console.log('[Gesture] firing swipe_right → next window')
        focusNextWindow()
        notify('👋 Next window', 'info')
        break
      case 'swipe_left':
        console.log('[Gesture] firing swipe_left → prev window')
        focusPrevWindow()
        notify('👋 Previous window', 'info')
        break
      default:
        console.log('[Gesture] runAction called with unhandled gesture:', gesture)
        break
    }
  }, [ready, clickAtCursor])

  // ── Hold-fire scheduler (for non-pinch, non-cursor gestures) ───────────────
  // cancelHold must be a useCallback so scheduleHold always calls the stable version.
  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
      holdGestureRef.current = null
    }
  }, [])

  const scheduleHold = useCallback((gesture) => {
    // Auto-expire the latch after 3s so the same gesture can re-fire
    // without needing to go fully neutral first.
    if (gesture === lastFiredRef.current) {
      if (Date.now() - lastFiredAtRef.current < 3000) return
      lastFiredRef.current = null  // latch expired — allow re-fire
    }
    // A timer is already ticking for this exact gesture — let it run, don't reset it.
    if (holdTimerRef.current !== null && holdGestureRef.current === gesture) return
    // Different gesture coming in — cancel the old timer and start fresh.
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
      holdGestureRef.current = null
    }
    holdGestureRef.current = gesture
    holdTimerRef.current = setTimeout(() => {
      console.log('[Gesture] hold timer fired for:', gesture)
      runAction(gesture)
      lastFiredRef.current = gesture
      lastFiredAtRef.current = Date.now()
      holdTimerRef.current = null
      holdGestureRef.current = null
    }, HOLD_MS)
    console.log('[Gesture] scheduleHold queued:', gesture, 'in', HOLD_MS, 'ms')
  }, [runAction])

  // ── Frame handler ──────────────────────────────────────────────────────────
  // Built as a plain function assigned to a ref so MediaPipe never needs to
  // re-register its callback when React re-renders change runAction etc.
  const onResults = useCallback((results) => {
    const lm = results.multiHandLandmarks?.[0]
    if (!lm) {
      hideCursor()
      histRef.current = []
      swipeTrackRef.current = []
      lastFiredRef.current = null
      lastFiredAtRef.current = 0
      cancelHold()
      setGesture(null)
      return
    }

    const { gesture, features } = classify(lm)

    // Move cursor only when cursor mode is on.
    if (features?.indexTip && useOsStore.getState().gestureCursorEnabled) {
      cursorFromLandmark(features.indexTip)
    } else if (!useOsStore.getState().gestureCursorEnabled) {
      hideCursor()
    }

    // Track wrist for swipe.
    if (features?.wrist) {
      swipeTrackRef.current.push({ x: features.wrist.x, t: Date.now() })
      if (swipeTrackRef.current.length > 8) swipeTrackRef.current.shift()
      const tr = swipeTrackRef.current
      if (tr.length >= 6) {
        const dx = tr[tr.length - 1].x - tr[0].x
        const dt = tr[tr.length - 1].t - tr[0].t
        if (Math.abs(dx) > SWIPE_DX && dt > 50 && dt < SWIPE_MS) {
          if (ready('swipe', 800)) {
            runAction(dx < 0 ? 'swipe_right' : 'swipe_left')
            swipeTrackRef.current = []
          }
        }
      }
    }

    // Pinch fires immediately — only when cursor is on so we have a position.
    if (gesture === 'pinch') {
      if (useOsStore.getState().gestureCursorEnabled && ready('click', CONFIG.CLICK_COOLDOWN)) {
        const pos = cursorPosRef.current
        const now = Date.now()
        const target = pos ? document.elementFromPoint(pos.x, pos.y) : null

        // Double-click detection: same target within 500ms → fire dblclick too
        if (
          target &&
          target === lastPinchTargetRef.current &&
          now - lastPinchTimeRef.current < 500
        ) {
          // Fire the dblclick on the same target
          try {
            target.dispatchEvent(new MouseEvent('dblclick', {
              bubbles: true, cancelable: true, view: window,
              clientX: pos.x, clientY: pos.y,
              button: 0, buttons: 1
            }))
            useOsStore.getState().addNotification('👌👌 Double-click', 'info')
          } catch (e) { /* ignore */ }
          lastPinchTargetRef.current = null
          lastPinchTimeRef.current = 0
        } else {
          clickAtCursor('left')
          lastPinchTargetRef.current = target
          lastPinchTimeRef.current = now
          useOsStore.getState().addNotification('👌 Click', 'info')
        }
      }
      setGesture('pinch')
      lastFiredRef.current = 'pinch'
      lastFiredAtRef.current = Date.now()
      cancelHold()
      return
    }

    // Majority vote over the last 5 frames for stability.
    histRef.current.push(gesture)
    if (histRef.current.length > 5) histRef.current.shift()
    const counts = {}
    histRef.current.forEach((g) => { if (g) counts[g] = (counts[g] || 0) + 1 })
    let stable = null, top = 0
    for (const k of Object.keys(counts)) if (counts[k] > top) { top = counts[k]; stable = k }
    if (top < VOTE_MIN) stable = null

    setGesture(stable || gesture)

    // Reset latch when hand goes back to neutral / cursor-only.
    if (!stable || stable === 'point') {
      lastFiredRef.current = null
      lastFiredAtRef.current = 0
      cancelHold()
      return
    }

    // Schedule hold for non-pinch actionable gestures.
    scheduleHold(stable)
  }, [hideCursor, cursorFromLandmark, ready, runAction, clickAtCursor, scheduleHold, cancelHold])

  // Keep ref in sync so the stable proxy below always calls the latest version.
  useEffect(() => { onResultsRef.current = onResults }, [onResults])

  // ── MediaPipe + camera lifecycle ───────────────────────────────────────────
  // NOTE: We pass a stable proxy function to hands.onResults so MediaPipe
  // never needs to re-register (which would restart the camera). The proxy
  // just forwards to onResultsRef.current which always holds the latest version.
  useEffect(() => {
    if (!gestureEnabled) return

    let cancelled = false
    setStatus('loading'); setError(null)

    // Stable proxy — created once per mount, always forwards to latest onResults.
    const stableProxy = (results) => {
      if (onResultsRef.current) onResultsRef.current(results)
    }

    const init = async () => {
      try {
        // Load MediaPipe Hands. The classic UMD build is preloaded by index.html;
        // dynamic-import the npm package as a safe fallback.
        let HandsCtor = window.Hands
        if (typeof HandsCtor !== 'function') {
          const mod = await import('@mediapipe/hands')
          HandsCtor = mod.Hands
        }
        const hands = new HandsCtor({
          locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
        })
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5
        })
        hands.onResults(stableProxy)
        handsRef.current = hands

        // Acquire camera and pipe into both the hidden processing video
        // and the visible mirrored preview.
        const stream = await acquireCamera()
        if (cancelled) { releaseCamera(); return }
        hadCameraRef.current = true
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await new Promise((r) => { videoRef.current.onloadedmetadata = r })
          await videoRef.current.play().catch(() => {})
        }
        if (previewRef.current) {
          previewRef.current.srcObject = stream
          previewRef.current.play().catch(() => {})
        }

        if (cancelled) return
        setStatus('ready')
        addNotification('🖐 Gesture control ready', 'info')

        // Per-frame loop. We use rAF rather than the deprecated Camera utility
        // so we don't pull in a second copy of the camera helper.
        const tick = async () => {
          if (cancelled) return
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try { await hands.send({ image: videoRef.current }) }
            catch (err) { /* transient frame errors are fine */ }
          }
          animRef.current = requestAnimationFrame(tick)
        }
        animRef.current = requestAnimationFrame(tick)
      } catch (err) {
        console.error('[Gesture] init failed:', err)
        if (!cancelled) {
          setStatus('error')
          setError(err.message || 'Could not start gesture control')
          addNotification('❌ Gesture failed: ' + (err.message || 'unknown'), 'error')
        }
      }
    }

    init()

    return () => {
      cancelled = true
      cancelHold()
      if (animRef.current) cancelAnimationFrame(animRef.current)
      animRef.current = null
      if (handsRef.current) { try { handsRef.current.close() } catch (_) {} ; handsRef.current = null }
      if (videoRef.current)   videoRef.current.srcObject = null
      if (previewRef.current) previewRef.current.srcObject = null
      streamRef.current = null
      if (hadCameraRef.current) {
        releaseCamera()
        hadCameraRef.current = false
      }
      hideCursor()
    }
  }, [gestureEnabled, hideCursor, addNotification, cancelHold])

  // ── UI ────────────────────────────────────────────────────────────────────
  if (!gestureEnabled) return null

  return (
    <>
      {/* On-screen virtual cursor */}
      <div
        ref={cursorRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: 0, top: 0,
          width: 28, height: 28,
          borderRadius: '50%',
          background: 'rgba(132, 134, 232, 0.55)',
          border: '2px solid #fff',
          boxShadow: '0 0 12px rgba(132,134,232,0.7), 0 0 24px rgba(132,134,232,0.4)',
          transform: 'translate3d(-100px, -100px, 0)',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 100000,
          transition: 'opacity 200ms ease'
        }}
      />
      <style>{`
        .gc-pulse { animation: gc-pulse 220ms ease-out; }
        @keyframes gc-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(132,134,232,0.55); }
          50%  { box-shadow: 0 0 0 14px rgba(132,134,232,0.0); }
          100% { box-shadow: 0 0 12px rgba(132,134,232,0.7), 0 0 24px rgba(132,134,232,0.4); }
        }
      `}</style>

      {/* Hidden video used for inference */}
      <video ref={videoRef} playsInline muted autoPlay
             style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1 }} />

      {/* Visible mirrored preview — small, pinned bottom-right, draggable out of way */}
      <div className="fixed bottom-24 right-5 z-[9998]">
        <div className="relative">
          <video
            ref={previewRef}
            playsInline muted autoPlay
            className="w-44 h-32 rounded-xl border border-bd object-cover"
            style={{ transform: 'scaleX(-1)', background: 'var(--surface)' }}
          />
          <div className="absolute top-1 left-1 px-2 py-0.5 rounded-md text-[10px] font-medium"
               style={{
                 background: 'rgba(0,0,0,0.55)',
                 color: status === 'ready' ? '#34d399' : status === 'error' ? '#f87171' : '#fbbf24'
               }}>
            {status === 'ready' ? 'tracking' : status === 'error' ? 'error' : 'loading…'}
          </div>
          {currentGesture && (
            <div className="absolute bottom-1 left-1 px-2 py-0.5 rounded-md text-[10px] font-bold"
                 style={{ background: 'rgba(132,134,232,0.30)', color: '#fff' }}>
              {currentGesture}
            </div>
          )}

          {/* Cursor-movement toggle button */}
          <button
            onClick={toggleGestureCursor}
            title={gestureCursorEnabled ? 'Disable cursor movement' : 'Enable cursor movement'}
            className="absolute bottom-1 right-1 w-6 h-6 rounded-md flex items-center justify-center"
            style={{
              background: gestureCursorEnabled
                ? 'rgba(132,134,232,0.85)'
                : 'rgba(80,80,80,0.85)',
              color: '#fff',
              fontSize: 11,
              lineHeight: 1
            }}
          >
            {gestureCursorEnabled ? '🖱' : '🚫'}
          </button>

          <button
            onClick={() => setGestureEnabled(false)}
            title="Turn off gesture control"
            className="absolute top-1 right-1 w-6 h-6 rounded-md flex items-center justify-center"
            style={{
              background: 'rgba(239,68,68,0.85)', color: '#fff',
              fontSize: 12, lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>
        {error && (
          <div className="mt-1 text-[11px] text-red-400 max-w-[180px]">{error}</div>
        )}
        {/* Cursor status label under preview */}
        <div className="mt-1 text-center text-[10px]"
             style={{ color: gestureCursorEnabled ? '#a78bfa' : '#9ca3af' }}>
          cursor {gestureCursorEnabled ? 'ON' : 'OFF'}
        </div>
      </div>

      {/* Floating gesture legend (top-right) */}
      <div className="fixed top-20 right-5 z-[9997] glass-panel rounded-2xl px-3 py-2 text-[11px] text-fg max-w-[200px]"
           style={{ pointerEvents: 'none' }}>
        <div className="font-semibold text-fg mb-1">Gestures</div>
        <div className="space-y-0.5 text-fg-mut">
          <div>👆 Point — move cursor</div>
          <div>👌 Pinch — click / double-click</div>
          <div>✊ Fist — right click</div>
          <div>🖐 Open palm — Notes</div>
          <div>👍 Thumb up — Files</div>
          <div>👎 Thumb down — close</div>
          <div>✌️ Peace — Calculator</div>
          <div>🤟 Three — Translator</div>
          <div>👋 Swipe — switch window</div>
        </div>
        <div className="mt-1.5 pt-1.5 border-t border-white/10 text-fg-mut">
          🖱/🚫 toggle cursor in preview
        </div>
      </div>
    </>
  )
}

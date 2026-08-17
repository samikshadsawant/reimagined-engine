SavitaOS — Eye Tracking Fix: Full Structural Prompt

Paste this entire prompt to your AI coding assistant. Fix all issues in order. Do not skip any step.


ROOT CAUSE ANALYSIS (why cursor is not moving)
There are 4 actual root causes in this codebase:

WebGazer opens a second independent camera stream — EyeTracker.jsx calls acquireCamera() which opens a shared stream, then wg.begin() internally calls its own getUserMedia(). Two camera streams compete. WebGazer's face detection runs on its private stream, not the shared one. This is the primary cause of failure.
No real calibration = Ridge Regression model never trained — WebGazer's setGazeListener fires data = null until the model has been trained with webgazer.recordScreenPosition(x, y) clicks. The current code fakes calibration with a 5-second timer. No training data = no cursor movement ever.
TF.js version conflict — webgazer.js (5.5MB, client/public/webgazer.js) bundles its own TF.js. The npm package @tensorflow/tfjs: ^4.22.0 in package.json also gets pre-bundled by Vite. Both register on window.tf. Vite does NOT have optimizeDeps.exclude: ['webgazer'] so it may also try to process the npm webgazer package, causing a double-load.
setGazeListener is set BEFORE wg.begin() resolves — WebGazer internally resets listener state during initialization. The listener must be re-registered after begin() completes.


FIX 1 — client/vite.config.js — Add optimizeDeps exclusion
Replace the entire file:
jsimport { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['webgazer'],      // ← prevent Vite from pre-bundling npm webgazer
    include: [],
  },
  server: {
    port: 5173,
    headers: {
      'Permissions-Policy': 'camera=*, microphone=*',
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:3001', ws: true }
    }
  }
})

FIX 2 — client/package.json — Remove npm webgazer dependency
The webgazer npm package in dependencies conflicts with the local /webgazer.js script tag. WebGazer is already loaded as a global via <script src="/webgazer.js"> in index.html. The npm package must be removed to prevent Vite from bundling a second copy.
Remove this line from "dependencies":
"webgazer": "^2.1.2",
After editing, run:
bashnpm install

FIX 3 — client/src/input/EyeTracker.jsx — Full rewrite
The existing EyeTracker.jsx has three fatal flaws: it calls acquireCamera() (causing double-stream), it sets the gaze listener before begin(), and it has no real calibration. Replace the entire file with:
jsximport React, { useEffect, useRef, useState, useCallback } from 'react'
import useOsStore from '../store/osStore'

/**
 * EyeTracker.jsx
 *
 * WebGazer manages its OWN camera stream internally — do NOT call acquireCamera()
 * here. Calling acquireCamera() AND wg.begin() opens two separate getUserMedia
 * streams and causes silent failure in WebGazer's face detection.
 *
 * Flow:
 *  1. Poll for window.webgazer (loaded via <script src="/webgazer.js"> in index.html)
 *  2. Configure WebGazer options
 *  3. Call wg.begin() — WebGazer opens its OWN camera stream internally
 *  4. AFTER begin() resolves, register setGazeListener (not before — begin() resets it)
 *  5. Show calibration overlay — user must click 9 points to train Ridge Regression
 *  6. After calibration, gaze predictions start flowing and cursor moves
 */

const CALIBRATION_POINTS = [
  { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 },
  { x: 0.1, y: 0.9 }, { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 },
]

function EyeTracker() {
  const [isActive, setIsActive]           = useState(false)
  const [error, setError]                 = useState(null)
  const [gazePosition, setGazePosition]   = useState({ x: -100, y: -100 })
  const [retryCount, setRetryCount]       = useState(0)
  const [calibrating, setCalibrating]     = useState(false)
  const [calStep, setCalStep]             = useState(0)
  const [calClicks, setCalClicks]         = useState(0) // clicks per point
  const [calibrated, setCalibrated]       = useState(false)

  const webgazerRef  = useRef(null)
  const animationRef = useRef(null)
  const dwellRef     = useRef({ x: 0, y: 0, time: Date.now() })
  const previewRef   = useRef(null)
  const gazeRef      = useRef({ x: -100, y: -100 }) // avoid stale closure in RAF

  const { eyeTrackingEnabled, addNotification } = useOsStore()

  const cleanup = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    if (webgazerRef.current) {
      try {
        webgazerRef.current.clearGazeListener()
        webgazerRef.current.end()
      } catch (_) {}
      webgazerRef.current = null
    }
    // Remove all DOM elements WebGazer injects — prevents stacking on retry
    ['webgazerVideoFeed', 'webgazerVideoCanvas', 'webgazerFaceFeedbackBox', 'webgazerGazeDot']
      .forEach(id => document.getElementById(id)?.remove())
    setIsActive(false)
    setCalibrating(false)
    setCalStep(0)
    setCalClicks(0)
  }, [])

  const moveCursor = useCallback((x, y) => {
    gazeRef.current = { x, y }
    setGazePosition({ x, y })
    const el = document.getElementById('gaze-cursor')
    if (el) {
      el.style.left = `${x}px`
      el.style.top  = `${y}px`
    }
  }, [])

  // Move WebGazer's injected video feed into our preview box
  const attachPreviewVideo = useCallback(() => {
    if (!previewRef.current) return
    const wgVideo = document.getElementById('webgazerVideoFeed')
    if (wgVideo) {
      wgVideo.style.cssText = 'width:100%;height:100%;object-fit:cover;transform:scaleX(-1);border-radius:8px;'
      // Prevent duplicate appends
      if (!previewRef.current.contains(wgVideo)) {
        previewRef.current.innerHTML = ''
        previewRef.current.appendChild(wgVideo)
      }
    }
    // Hide WebGazer's own overlay elements
    const hide = id => { const el = document.getElementById(id); if (el) el.style.display = 'none' }
    hide('webgazerVideoCanvas')
    hide('webgazerFaceFeedbackBox')
    hide('webgazerGazeDot')
  }, [])

  useEffect(() => {
    if (!eyeTrackingEnabled) { cleanup(); return }

    let cancelled = false

    const init = async () => {
      setError(null)

      // Step 1: Wait for window.webgazer — loaded as <script src="/webgazer.js"> in index.html
      let tries = 0
      while (!window.webgazer && tries < 50) {           // up to 12.5s
        await new Promise(r => setTimeout(r, 250))
        tries++
      }
      if (!window.webgazer) {
        setError('WebGazer failed to load. Check that client/public/webgazer.js exists.')
        return
      }
      if (cancelled) return

      const wg = window.webgazer
      webgazerRef.current = wg

      // Step 2: Configure BEFORE begin()
      try {
        wg.showVideoPreview(true)        // we capture the video element into our preview box
        wg.showPredictionPoints(false)   // hide the red dot WebGazer draws
        wg.showFaceOverlay(false)
        wg.showFaceFeedbackBox(false)
      } catch (configErr) {
        console.warn('[EyeTracker] config warning:', configErr.message)
      }

      // Step 3: Start WebGazer — it calls getUserMedia internally
      // DO NOT call acquireCamera() here — that would open a duplicate stream
      try {
        await wg.begin()
        console.log('[EyeTracker] ✅ WebGazer started')
      } catch (e) {
        console.error('[EyeTracker] begin() failed:', e)
        if (e.name === 'NotAllowedError' || e.message?.includes('Permission')) {
          setError('Camera permission denied — allow camera in browser and click Retry.')
        } else if (e.name === 'NotReadableError') {
          setError('Camera in use by another app — close Zoom/Meet and click Retry.')
        } else {
          setError('Eye tracking failed: ' + e.message)
        }
        addNotification('Eye tracking failed to start', 'warn')
        return
      }

      if (cancelled) { cleanup(); return }

      // Step 4: Register gaze listener AFTER begin() — begin() resets internal state
      wg.setGazeListener((data, _clock) => {
        if (data && typeof data.x === 'number' && typeof data.y === 'number') {
          moveCursor(Math.round(data.x), Math.round(data.y))
        }
      })

      // Step 5: Move WebGazer's injected video into our preview box
      setTimeout(attachPreviewVideo, 700)
      setTimeout(attachPreviewVideo, 1800)   // second attempt for slow GPUs

      setIsActive(true)
      addNotification('Eye tracking started — calibrate for accuracy', 'info')

      // Step 6: Start calibration flow
      setCalibrated(false)
      setCalibrating(true)
      setCalStep(0)
      setCalClicks(0)
    }

    init()
    return () => { cancelled = true; cleanup() }
  }, [eyeTrackingEnabled, retryCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // Dwell click — fires after gaze stays in same 30px zone for 1.5s
  useEffect(() => {
    if (!isActive || !calibrated) return
    const checkDwell = () => {
      const now = Date.now()
      const { x, y } = gazeRef.current
      const dx = Math.abs(x - dwellRef.current.x)
      const dy = Math.abs(y - dwellRef.current.y)
      if (dx > 30 || dy > 30) {
        dwellRef.current = { x, y, time: now }
      } else if (now - dwellRef.current.time > 1500) {
        const el = document.elementFromPoint(x, y)
        if (el) {
          el.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }))
        }
        dwellRef.current.time = now
      }
      animationRef.current = requestAnimationFrame(checkDwell)
    }
    animationRef.current = requestAnimationFrame(checkDwell)
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [isActive, calibrated])

  // Handle calibration point click — records training data into WebGazer
  const handleCalibrationClick = useCallback((screenX, screenY) => {
    if (!webgazerRef.current) return
    // 5 clicks per point trains the model adequately
    const newClicks = calClicks + 1
    setCalClicks(newClicks)
    try {
      webgazerRef.current.recordScreenPosition(screenX, screenY, 'click')
    } catch (e) {
      console.warn('[EyeTracker] recordScreenPosition error:', e.message)
    }
    if (newClicks >= 5) {
      const nextStep = calStep + 1
      if (nextStep >= CALIBRATION_POINTS.length) {
        setCalibrating(false)
        setCalibrated(true)
        addNotification('Eye tracking calibrated ✅', 'info')
        dwellRef.current = { x: 0, y: 0, time: Date.now() }
      } else {
        setCalStep(nextStep)
        setCalClicks(0)
      }
    }
  }, [calClicks, calStep, addNotification])

  if (!eyeTrackingEnabled) return null

  const currentCalPoint = calibrating && CALIBRATION_POINTS[calStep]
    ? {
        x: Math.round(CALIBRATION_POINTS[calStep].x * window.innerWidth),
        y: Math.round(CALIBRATION_POINTS[calStep].y * window.innerHeight),
      }
    : null

  return (
    <>
      {/* Gaze cursor — moved by moveCursor() via direct DOM manipulation for zero-lag */}
      <div id="gaze-cursor" style={{
        position: 'fixed',
        width: 18, height: 18,
        borderRadius: '50%',
        background: 'rgba(139,92,246,0.65)',
        border: '2px solid rgba(167,139,250,0.9)',
        pointerEvents: 'none',
        zIndex: 99999,
        transform: 'translate(-50%,-50%)',
        transition: 'left 0.04s linear, top 0.04s linear',
        left: gazePosition.x,
        top: gazePosition.y,
      }} />

      {/* Calibration overlay — full screen, blocks interaction until done */}
      {calibrating && currentCalPoint && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99998,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ color: '#f0f0f5', fontSize: 16, marginBottom: 12, fontFamily: 'Geist, sans-serif' }}>
            🎯 Calibration — Look at the dot and click it ({calStep + 1}/{CALIBRATION_POINTS.length})
          </div>
          <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8 }}>
            Click {5 - calClicks} more time{5 - calClicks !== 1 ? 's' : ''} on the dot while looking at it
          </div>
          {/* Calibration dot — positioned at the target calibration point */}
          <div
            onClick={() => handleCalibrationClick(currentCalPoint.x, currentCalPoint.y)}
            style={{
              position: 'fixed',
              left: currentCalPoint.x,
              top: currentCalPoint.y,
              transform: 'translate(-50%,-50%)',
              width: 28, height: 28,
              borderRadius: '50%',
              background: '#8b5cf6',
              border: '3px solid #a78bfa',
              cursor: 'crosshair',
              boxShadow: '0 0 16px rgba(139,92,246,0.8)',
              animation: 'pulse 1s ease-in-out infinite',
            }}
          />
          <style>{`
            @keyframes pulse {
              0%,100% { box-shadow: 0 0 8px rgba(139,92,246,0.6); }
              50% { box-shadow: 0 0 24px rgba(139,92,246,1); }
            }
          `}</style>
          <button
            onClick={() => { setCalibrating(false); setCalibrated(true) }}
            style={{
              position: 'fixed', bottom: 32, right: 32,
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: 'rgba(139,92,246,0.2)', color: '#a78bfa',
              cursor: 'pointer', fontSize: 13,
            }}
          >
            Skip calibration
          </button>
        </div>
      )}

      {/* Camera preview panel — top-left corner */}
      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 9999, width: 160 }}>
        <div ref={previewRef} style={{
          width: 160, height: 120, borderRadius: 10, overflow: 'hidden',
          border: `2px solid ${isActive ? '#8b5cf6' : '#4b5563'}`,
          background: '#000', position: 'relative',
        }}>
          {!isActive && !error && (
            <div style={{
              width: '100%', height: '100%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: '#6b7280', fontSize: 11, textAlign: 'center', padding: '0 8px',
            }}>
              ⏳ Loading WebGazer...
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          {isActive
            ? calibrated ? '✅ Tracking Active' : '🎯 Needs Calibration'
            : '⭕ Inactive'}
        </div>

        {isActive && calibrated && (
          <button
            onClick={() => { setCalibrated(false); setCalibrating(true); setCalStep(0); setCalClicks(0) }}
            style={{
              marginTop: 4, width: '100%', padding: '3px 0', borderRadius: 6,
              border: 'none', cursor: 'pointer',
              background: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontSize: 11,
            }}
          >
            🔄 Recalibrate
          </button>
        )}

        {error && (
          <>
            <div style={{ fontSize: 11, color: '#f87171', marginTop: 4, textAlign: 'center' }}>
              {error}
            </div>
            <button
              onClick={() => { cleanup(); setError(null); setRetryCount(c => c + 1) }}
              style={{
                marginTop: 6, width: '100%', padding: '4px 0', borderRadius: 6,
                border: 'none', cursor: 'pointer',
                background: 'rgba(139,92,246,0.2)', color: '#a78bfa', fontSize: 11,
              }}
            >
              🔄 Retry
            </button>
          </>
        )}

        {!error && calibrated && (
          <div style={{ textAlign: 'center', fontSize: 11, color: '#6b7280', marginTop: 2 }}>
            Dwell click: 1.5s
          </div>
        )}
      </div>
    </>
  )
}

export default EyeTracker

FIX 4 — client/src/input/GestureController.jsx — Remove duplicate eye tracking state
At line 106, there is a local eyeTrackingEnabled state that shadows the osStore one and causes confusion. Remove these three lines:
js// DELETE these 3 lines (around line 106):
const [eyeTrackingEnabled, setEyeTrackingEnabled] = useState(false)
const [gazeDirection, setGazeDirection] = useState(null)
const [blinkCount, setBlinkCount] = useState(0)
Then search the entire GestureController.jsx file for any usage of eyeTrackingEnabled, setEyeTrackingEnabled, gazeDirection, setGazeDirection, blinkCount, setBlinkCount that relates to this local state and remove those usages too. Do not touch the faceMeshRef — FaceMesh is still needed for blink detection in GestureController.

FIX 5 — Clear stale WebGazer localStorage data
WebGazer stores regression training data in localStorage under keys like webgazerGlobalData. If the user has old/corrupted training data, gaze prediction will be inaccurate even after re-calibration. Add this one-time clear to the cleanup function in the new EyeTracker.jsx:
In the cleanup callback, add after webgazerRef.current = null:
js// Clear stale WebGazer regression data so next start is fresh
try {
  const keysToRemove = Object.keys(localStorage).filter(k =>
    k.startsWith('webgazer') || k === 'webgazerGlobalData'
  )
  keysToRemove.forEach(k => localStorage.removeItem(k))
} catch (_) {}
Also call this clear inside the Retry button's onClick handler.

FIX 6 — client/index.html — Verify WebGazer script position
Confirm the <script src="/webgazer.js"> tag is AFTER the MediaPipe scripts and BEFORE <script type="module" src="/src/main.jsx">. The order must be:
html<script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js" crossorigin="anonymous"></script>

<!-- WebGazer must load BEFORE the React app module -->
<script src="/webgazer.js"></script>

<script type="module" src="/src/main.jsx"></script>
If the webgazer script is currently AFTER main.jsx, move it above it.

FIX 7 — client/src/input/sharedCamera.js — Do not increment refcount for WebGazer
WebGazer manages its own camera stream and never calls acquireCamera() or releaseCamera(). The sharedCamera.js file is correct as-is — do not change it. The only change is that EyeTracker.jsx (Fix 3) no longer calls acquireCamera() at all.

VERIFICATION CHECKLIST
After all fixes, verify in this order:

Open browser DevTools → Console. Refresh the page. You should see [EyeTracker] ✅ WebGazer started when eye tracking is enabled. No TypeError: wg.begin is not a function or NotReadableError.
Open DevTools → Network tab → filter by "webgazer". Confirm /webgazer.js loads with status 200. Confirm there is only one request for it (no CDN fallback request).
With eye tracking enabled, the camera preview box (top-left) should show your face within 2–3 seconds.
The calibration overlay must appear. Click each purple dot 5 times while looking at it. All 9 points must be completed (or skip).
After calibration, slowly move your eyes left/right. The purple gaze cursor on screen must visibly follow. If it doesn't move at all, open Console and look for errors from WebGazer — specifically [EyeTracker] begin() failed.
Confirm gesture control still works independently — gestures should not be affected by this change.
Toggle eye tracking OFF then ON — it should restart cleanly without a page reload. The Retry button must work.
Paste this entire prompt to your AI coding assistant:


SavitaOS — Full Eye Tracking & Gesture System Fix
Audit-Based Structured Refactor (15 Issues, 9 Files)
Fix all issues below in exact order. Do not skip any step. Each fix builds on the previous one.

PHASE 1 — CRITICAL FIXES (Do these first, nothing works without them)

FIX 1 — Create a Single Shared Camera Stream Manager
New file: client/src/input/sharedCamera.js
This is the most important fix. Right now GestureController, EyeTracker, FaceRecognition, and SignLanguageController ALL open their own getUserMedia stream independently, causing camera resource conflicts. Replace all of them with one shared stream:
js/**
 * sharedCamera.js
 * Single source of truth for the webcam stream.
 * All components must use this instead of calling getUserMedia directly.
 */

let _stream = null
let _refCount = 0

export async function acquireCamera() {
  _refCount++
  if (_stream && _stream.active) return _stream
  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 960, height: 540 },
      audio: false
    })
    return _stream
  } catch (err) {
    _refCount--
    throw err
  }
}

export function releaseCamera() {
  _refCount = Math.max(0, _refCount - 1)
  if (_refCount === 0 && _stream) {
    _stream.getTracks().forEach(t => t.stop())
    _stream = null
  }
}

export function getStream() {
  return _stream
}

FIX 2 — Update GestureController.jsx to use shared camera
Find the getUserMedia call (around line 728):
js// DELETE THIS:
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'user', width: 960, height: 540 }
})
streamRef.current = stream
Replace with:
jsimport { acquireCamera, releaseCamera } from './sharedCamera'

// In init function:
const stream = await acquireCamera()
streamRef.current = stream
In the cleanup function, replace stream.getTracks().forEach(t => t.stop()) with:
jsreleaseCamera()

FIX 3 — Update FaceRecognition.jsx to use shared camera
Remove the _sharedStream module-level variable entirely (lines 26-31). Replace all _sharedStream usage with:
jsimport { acquireCamera, releaseCamera } from './sharedCamera'

// Where camera is acquired:
const stream = await acquireCamera()

// In cleanup/unmount:
releaseCamera()

FIX 4 — Update SignLanguageController.jsx to use shared camera
Same pattern — remove any _sharedStream or direct getUserMedia call. Replace with:
jsimport { acquireCamera, releaseCamera } from './sharedCamera'
const stream = await acquireCamera()
// cleanup:
releaseCamera()

FIX 5 — Complete EyeTracker.jsx rewrite (WebGazer CDN + camera preview fix)
First, add WebGazer to client/index.html inside <head>:
html<meta http-equiv="Permissions-Policy" content="camera=*, microphone=*">
Add before <script type="module" src="/src/main.jsx"> in <body>:
html<script src="https://webgazer.cs.brown.edu/webgazer.js" type="text/javascript" async></script>
Then replace the entire EyeTracker.jsx with:
jsximport React, { useEffect, useRef, useState, useCallback } from 'react'
import useOsStore from '../store/osStore'
import { acquireCamera, releaseCamera } from './sharedCamera'

function EyeTracker() {
  const [isActive, setIsActive]           = useState(false)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [error, setError]                 = useState(null)
  const [gazePosition, setGazePosition]   = useState({ x: 0, y: 0 })
  const [retryCount, setRetryCount]       = useState(0)

  const webgazerRef  = useRef(null)
  const animationRef = useRef(null)
  const dwellRef     = useRef({ x: 0, y: 0, time: Date.now() })
  const previewRef   = useRef(null)

  const { eyeTrackingEnabled, addNotification } = useOsStore()

  const cleanup = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    if (webgazerRef.current) {
      try { webgazerRef.current.end() } catch (_) {}
      webgazerRef.current = null
    }
    // Remove WebGazer's injected DOM elements to prevent stacking on retry
    ['webgazerVideoFeed','webgazerVideoCanvas','webgazerFaceFeedbackBox','webgazerGazeDot']
      .forEach(id => document.getElementById(id)?.remove())
    releaseCamera()
    setIsActive(false)
  }, [])

  const moveCursor = useCallback((x, y) => {
    const el = document.getElementById('gaze-cursor')
    if (el) { el.style.left = `${x}px`; el.style.top = `${y}px` }
  }, [])

  // After WebGazer injects its own video into <body>, move it into our preview box
  const attachWebgazerVideo = useCallback(() => {
    if (!previewRef.current) return
    const wgVideo = document.getElementById('webgazerVideoFeed')
    if (wgVideo) {
      wgVideo.style.cssText = 'width:100%;height:100%;object-fit:cover;transform:scaleX(-1);'
      previewRef.current.appendChild(wgVideo)
    }
  }, [])

  useEffect(() => {
    if (!eyeTrackingEnabled) { cleanup(); return }

    const init = async () => {
      setError(null)

      // Step 1: Acquire shared camera stream first (permission check)
      try {
        await acquireCamera()
      } catch (err) {
        if (err.name === 'NotAllowedError')
          setError('Camera permission denied — click the camera icon in the address bar and allow, then Retry.')
        else if (err.name === 'NotFoundError')
          setError('No camera found on this device.')
        else if (err.name === 'NotReadableError')
          setError('Camera in use by another app — close Zoom/Meet etc., then Retry.')
        else
          setError(`Camera error: ${err.message}`)
        addNotification('Eye tracking requires camera access', 'warn')
        return
      }

      // Step 2: Wait for WebGazer global (loaded async from index.html)
      let tries = 0
      while (!window.webgazer && tries < 30) {
        await new Promise(r => setTimeout(r, 300))
        tries++
      }
      if (!window.webgazer) {
        setError('WebGazer failed to load — check your internet connection.')
        releaseCamera()
        return
      }

      // Step 3: Configure WebGazer
      const wg = window.webgazer
      webgazerRef.current = wg
      wg.showVideoPreview(true)
      wg.showPredictionPoints(false)
      wg.showFaceOverlay(false)
      wg.showFaceFeedbackBox(false)
      wg.setGazeListener((data) => {
        if (data) {
          const pos = { x: Math.round(data.x), y: Math.round(data.y) }
          setGazePosition(pos)
          moveCursor(pos.x, pos.y)
        }
      })

      // Step 4: Start WebGazer
      try {
        await wg.begin()
      } catch (e) {
        setError('Eye tracking failed to start: ' + e.message)
        addNotification('Eye tracking failed to start', 'warn')
        releaseCamera()
        return
      }

      // Step 5: Move WebGazer's injected video into our preview box
      setTimeout(attachWebgazerVideo, 600)

      setIsActive(true)
      setError(null)
      addNotification('Eye tracking active', 'info')
      setIsCalibrating(true)
      setTimeout(() => setIsCalibrating(false), 5000)
    }

    init()
    return () => cleanup()
  }, [eyeTrackingEnabled, retryCount])

  // Dwell click
  useEffect(() => {
    if (!isActive) return
    const checkDwell = () => {
      const now = Date.now()
      const dx = Math.abs(gazePosition.x - dwellRef.current.x)
      const dy = Math.abs(gazePosition.y - dwellRef.current.y)
      if (dx > 30 || dy > 30) {
        dwellRef.current = { x: gazePosition.x, y: gazePosition.y, time: now }
      } else if (now - dwellRef.current.time > 1500) {
        document.elementFromPoint(gazePosition.x, gazePosition.y)
          ?.dispatchEvent(new MouseEvent('click', { clientX: gazePosition.x, clientY: gazePosition.y, bubbles: true }))
        dwellRef.current.time = now
      }
      animationRef.current = requestAnimationFrame(checkDwell)
    }
    animationRef.current = requestAnimationFrame(checkDwell)
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [isActive, gazePosition])

  if (!eyeTrackingEnabled) return null

  return (
    <>
      <div id="gaze-cursor" style={{
        position:'fixed', width:16, height:16, borderRadius:'50%',
        background:'rgba(139,92,246,0.6)', pointerEvents:'none', zIndex:99999,
        transform:'translate(-50%,-50%)', transition:'left 0.05s,top 0.05s',
        left: isActive ? gazePosition.x : -100,
        top:  isActive ? gazePosition.y : -100,
      }}/>
      <div style={{ position:'fixed', top:16, left:16, zIndex:9999, width:160 }}>
        <div ref={previewRef} style={{
          width:160, height:120, borderRadius:10, overflow:'hidden', position:'relative',
          border:`2px solid ${isActive ? '#8b5cf6' : '#4b5563'}`, background:'#000'
        }}>
          {!isActive && !error && (
            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center',
              justifyContent:'center', color:'#6b7280', fontSize:11 }}>
              ⏳ Starting camera...
            </div>
          )}
          {isActive && (
            <div style={{
              position:'absolute', width:10, height:10, borderRadius:'50%', background:'#ef4444',
              transform:'translate(-50%,-50%)', pointerEvents:'none',
              left:`${(gazePosition.x/window.innerWidth)*100}%`,
              top:`${(gazePosition.y/window.innerHeight)*100}%`
            }}/>
          )}
        </div>
        <div style={{ textAlign:'center', fontSize:11, color:'#9ca3af', marginTop:4 }}>
          Eye Tracking {isActive ? '✅ Active' : '⭕ Inactive'}
        </div>
        {isCalibrating && <div style={{ textAlign:'center', fontSize:11, color:'#f59e0b', marginTop:2 }}>🎯 Calibrating...</div>}
        {error && <div style={{ fontSize:11, color:'#f87171', marginTop:4, textAlign:'center' }}>{error}</div>}
        {error && (
          <button onClick={() => { setError(null); setRetryCount(c => c+1) }}
            style={{ marginTop:6, width:'100%', padding:'4px 0', borderRadius:6,
              border:'none', cursor:'pointer', background:'rgba(139,92,246,0.2)', color:'#a78bfa', fontSize:11 }}>
            🔄 Retry
          </button>
        )}
        {!error && <div style={{ textAlign:'center', fontSize:11, color:'#6b7280', marginTop:2 }}>Dwell click: 1.5s</div>}
      </div>
    </>
  )
}
export default EyeTracker

PHASE 2 — HIGH SEVERITY FIXES

FIX 6 — Delete useGesture.js duplicate component
File: client/src/input/useGesture.js
This file exports a GestureController component that duplicates the one in GestureController.jsx. This causes Vite to resolve the wrong component unpredictably. Do this:

Delete the entire GestureController component function from useGesture.js (lines 168-202)
Remove the videoRef static property assignment (GestureController.videoRef = el)
Keep only the useGesture hook export in that file
Search the entire src/ folder for import.*useGesture — make sure none of them import GestureController from useGesture.js. If any do, redirect them to GestureController.jsx


FIX 7 — Resolve conflicting GESTURE_CONFIG exports
Files: gestureConfig.js and appConfig.js
These two files both export a GESTURE_CONFIG object with different content (timing values vs action mappings). This causes silent wrong-data bugs when the wrong file is imported.
Rename to make purpose explicit:

In gestureConfig.js: rename GESTURE_CONFIG → GESTURE_TIMING_CONFIG
In appConfig.js: rename GESTURE_CONFIG → GESTURE_ACTION_CONFIG
Update all import sites:

GestureController.jsx line 25: change GESTURE_CONFIG → GESTURE_TIMING_CONFIG
Any other file importing GESTURE_CONFIG — update to the correct renamed export based on whether it needs timing or action mappings




FIX 8 — Fix GestureController.jsx osEyeEnabled duplicate tracking
Around line 789 in GestureController.jsx:
js// REMOVE THIS BLOCK entirely:
if (faceMeshRef.current && osEyeEnabled) {
  await faceMeshRef.current.send({ image: videoRef.current })
}
Eye tracking is handled exclusively by EyeTracker.jsx via WebGazer. GestureController must NOT run FaceMesh for eye tracking in parallel — it causes duplicate camera processing and conflicts with WebGazer. Remove osEyeEnabled from GestureController's store destructure and all its usages inside that file.

PHASE 3 — MEDIUM SEVERITY FIXES

FIX 9 — Add .task model existence check in useGestureRecognizer.js
Before calling GestureRecognizer.createFromOptions (line 51), add:
jsconst modelCheck = await fetch(MODEL_PATH, { method: 'HEAD' })
if (!modelCheck.ok) {
  throw new Error(`Gesture model not found at ${MODEL_PATH}. Place gesture_recognizer.task in client/public/models/`)
}

FIX 10 — Fix stale closure on calibrationModeRef in GestureController.jsx
Around line 818, the ref is updated in a useEffect after render. Move the update to happen synchronously by passing a setter callback instead. Replace:
js// In useEffect:
calibrationModeRef.current = calibrationMode
With a direct update inside the toggle/set function that changes calibrationMode so the ref is always in sync before the next animation frame runs.

FIX 11 — Fix empty catch blocks in GestureController.jsx
Find all catch (e) { } or catch (e) { } empty blocks (lines 792, 799). Replace with:
jscatch (err) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[GestureController] frame error:', err.message)
  }
}

FIX 12 — Fix YOLO interval not restarting on dependency change (GestureController.jsx)
The yoloIntervalRef is started inside initMediaPipe but never restarted if osEyeEnabled changes while gestureEnabled stays true. After removing osEyeEnabled from GestureController (Fix 8), this issue resolves itself. Confirm the useEffect dependency array at line 814 only contains [gestureEnabled] after Fix 8.

PHASE 4 — LOW SEVERITY FIXES

FIX 13 — Persist input toggles in osStore.js
In osStore.js, find the partialize function (lines 260-271). Add the missing input toggle keys so they survive page refresh:
jspartialize: (state) => ({
  // existing keys...
  gestureEnabled: state.gestureEnabled,
  voiceEnabled: state.voiceEnabled,
  eyeTrackingEnabled: state.eyeTrackingEnabled,
  ttsEnabled: state.ttsEnabled,
  visualAlertsEnabled: state.visualAlertsEnabled,
})

FIX 14 — Surface WebGL fallback warning in useYoloDetector.js
Around lines 145-148 where WebGL fails and falls back to WASM, add a visible notification:
jscatch (webglErr) {
  console.warn('[YOLO] WebGL failed, falling back to WASM:', webglErr.message)
  // If you have access to addNotification here via props/store, call:
  // addNotification('YOLO running on CPU (WebGL unavailable) — slower performance', 'warn')
  // Then fall back:
  await InferenceSession.create(modelBuffer, { executionProviders: ['wasm'] })
}

FIX 15 — Update vite.config.js for camera headers
Replace the entire file:
jsimport { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['webgazer']
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

VERIFICATION CHECKLIST
After all fixes, confirm:

 Only ONE getUserMedia call happens at startup — check Network tab → no duplicate camera stream requests
 WebGazer loads from Brown CDN — check Network tab for webgazer.js with status 200
 Camera preview is visible inside the eye tracking panel on the UI
 No TypeError: (void 0) is not a constructor in console
 No GESTURE_CONFIG import conflicts — grep for it across all files
 useGesture.js no longer exports a GestureController component
 Toggling eye tracking off and back on works without page reload (Retry button works)
 Input toggles survive a page refresh (check localStorage savitaos-storage)
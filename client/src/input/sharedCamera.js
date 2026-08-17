/**
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

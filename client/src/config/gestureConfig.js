/**
 * Gesture Control Configuration
 * All values can be overridden via environment variables or settings
 */

// Gesture timing values (in milliseconds)
export const GESTURE_TIMING_CONFIG = {
  // Timing
  GESTURE_COOLDOWN: parseInt(import.meta.env.VITE_GESTURE_COOLDOWN) || 2000,
  GESTURE_HOLD_TIME: parseInt(import.meta.env.VITE_GESTURE_HOLD_TIME) || 800,
  CLICK_COOLDOWN: parseInt(import.meta.env.VITE_CLICK_COOLDOWN) || 300,
  KEY_COOLDOWN: parseInt(import.meta.env.VITE_KEY_COOLDOWN) || 250,
  BLINK_COOLDOWN: parseInt(import.meta.env.VITE_BLINK_COOLDOWN) || 800,
  MIN_KPT_CONF: parseFloat(import.meta.env.VITE_MIN_KPT_CONF) || 0.20,
  BLINK_FRAMES: parseInt(import.meta.env.VITE_BLINK_FRAMES) || 2,

  // Mouse control
  MOUSE_SMOOTHING: parseFloat(import.meta.env.VITE_MOUSE_SMOOTHING) || 0.55,
  POINTER_SENSITIVITY: parseFloat(import.meta.env.VITE_POINTER_SENSITIVITY) || 2.0,

  // History lengths for stability
  HAND_HISTORY_LEN: parseInt(import.meta.env.VITE_HAND_HISTORY_LEN) || 5,
  GAZE_HISTORY_LEN: parseInt(import.meta.env.VITE_GAZE_HISTORY_LEN) || 5,

  // Majority vote threshold
  MAJORITY_VOTE_MIN: parseInt(import.meta.env.VITE_MAJORITY_VOTE_MIN) || 3
}

// Default calibration thresholds (used before user calibration)
export const DEFAULT_CALIBRATION = {
  pinchThresh: parseFloat(import.meta.env.VITE_PINCH_THRESH) || 0.55,
  fistTipThresh: parseFloat(import.meta.env.VITE_FIST_TIP_THRESH) || 1.05,
  openTipThresh: parseFloat(import.meta.env.VITE_OPEN_TIP_THRESH) || 1.45,
  gazeLeftThresh: parseFloat(import.meta.env.VITE_GAZE_LEFT_THRESH) || 0.38,
  gazeRightThresh: parseFloat(import.meta.env.VITE_GAZE_RIGHT_THRESH) || 0.62,
  gazeUpThresh: parseFloat(import.meta.env.VITE_GAZE_UP_THRESH) || 0.38,
  gazeDownThresh: parseFloat(import.meta.env.VITE_GAZE_DOWN_THRESH) || 0.62,
  blinkEarThresh: parseFloat(import.meta.env.VITE_BLINK_EAR_THRESH) || 0.20,
  calibrated: false
}

// App defaults for window opening
export const APP_DEFAULTS = {
  FileExplorer: {
    width: parseInt(import.meta.env.VITE_APP_FILEEXPLORER_WIDTH) || 900,
    height: parseInt(import.meta.env.VITE_APP_FILEEXPLORER_HEIGHT) || 600
  },
  Calculator: {
    width: parseInt(import.meta.env.VITE_APP_CALCULATOR_WIDTH) || 320,
    height: parseInt(import.meta.env.VITE_APP_CALCULATOR_HEIGHT) || 480
  },
  Notes: {
    width: parseInt(import.meta.env.VITE_APP_NOTES_WIDTH) || 600,
    height: parseInt(import.meta.env.VITE_APP_NOTES_HEIGHT) || 500
  }
}

export default { GESTURE_TIMING_CONFIG, DEFAULT_CALIBRATION, APP_DEFAULTS }

// ── Phase 4.1 — Gesture-to-action mapping ────────────────────────────────────
// Do NOT delete existing gestures that are not in spec.
// Only the action targets have been updated to match the implementation guide.

export const GESTURE_ACTIONS = {
  THUMB_UP:          { action: 'OPEN_APP',    target: 'Browser',    label: 'Open Browser' },
  THUMB_DOWN:        { action: 'CLOSE_WINDOW', target: 'active',    label: 'Close Window' },
  THUMB_INDEX_PINCH: { action: 'OPEN_APP',    target: 'Calculator', label: 'Open Calculator' },
  THUMB_MIDDLE:      { action: 'OPEN_APP',    target: 'FileExplorer', label: 'Open File Explorer' },
  ALL_FINGERS_OPEN:  { action: 'OPEN_APP',    target: 'Mail',       label: 'Open Mail' },
  // Existing gestures retained — do not remove
  POINT:             { action: 'CURSOR_MOVE', target: null,         label: 'Move Cursor' },
  PEACE_SIGN:        { action: 'SCREENSHOT',  target: null,         label: 'Screenshot' }
}
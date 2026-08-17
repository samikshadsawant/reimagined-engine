/**
 * SignLanguageController.jsx — Phase 1.1.4
 *
 * Detects 8 ASL-style hand signs from the webcam and converts them to
 * on-screen text with TTS audio output.
 *
 * Reuses the existing camera stream — does NOT open a second getUserMedia.
 * Loads the trained TF.js model from /sign_model/model.json once on mount.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import { SIGN_LABELS, CONFIDENCE_THRESHOLD, DWELL_TIME_MS } from './signLanguage/signConfig';
import useTTS from '../hooks/useTTS';

const MODEL_URL = '/sign_model/model.json';
const HISTORY_LIMIT = 5;

// ── Shared camera stream — uses centralized sharedCamera.js ─────────────────
import { acquireCamera, releaseCamera } from './sharedCamera';

let _handsInstance = null;
async function getHandsInstance(onResults) {
  if (_handsInstance) {
    _handsInstance.onResults(onResults)
    return _handsInstance
  }

  // FIX L2: dynamic import instead of assuming window.Hands exists
  let HandsClass = window.Hands
  if (!HandsClass) {
    const mod = await import('@mediapipe/hands')
    HandsClass = mod.Hands
  }

  const hands = new HandsClass({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
  })
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5
  })
  hands.onResults(onResults)
  // FIX L3: removed manual hands.initialize() — MediaPipe auto-initializes on first send()
  _handsInstance = hands
  return hands
}
// ─────────────────────────────────────────────────────────────────────────────

export default function SignLanguageController() {
  const videoRef = useRef(null);
  const modelRef = useRef(null);
  const handsRef = useRef(null);
  const animFrameRef = useRef(null);
  const currentLandmarksRef = useRef(null);
  const dwellTimerRef = useRef(null);
  const lastDwellLabelRef = useRef(null);
  const hasCameraRef = useRef(false);

  const [currentSign, setCurrentSign] = useState(null);    // { label, confidence }
  const [history, setHistory] = useState([]);               // last 5 emitted signs
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState(null);
  const [error, setError] = useState(null);

  const { speak } = useTTS();

  // ── loadModel ──────────────────────────────────────────────────────────────
  const loadModel = useCallback(async () => {
    try {
      const model = await tf.loadLayersModel(MODEL_URL);
      modelRef.current = model;
      setModelReady(true);
    } catch (err) {
      console.warn('[SignLanguage] Model not found at', MODEL_URL,
        '— run trainClassifier.js to generate it. Sign language disabled.')
      setModelError('Sign language model not trained yet. See docs/SPIRITOS_BUILD_GUIDE.md.')
    }
  }, []);

  // ── normaliseLandmarks ────────────────────────────────────────────────────
  function normaliseLandmarks(landmarks) {
    const wrist = landmarks[0];
    const flat = new Float32Array(63);
    for (let i = 0; i < 21; i++) {
      flat[i * 3]     = landmarks[i].x - wrist.x;
      flat[i * 3 + 1] = landmarks[i].y - wrist.y;
      flat[i * 3 + 2] = (landmarks[i].z ?? 0) - (wrist.z ?? 0);
    }
    return flat;
  }

  // ── classifyFrame ─────────────────────────────────────────────────────────
  function classifyFrame(landmarks) {
    if (!modelRef.current) return null;
    const flat = normaliseLandmarks(landmarks);
    const input = tf.tensor2d([Array.from(flat)]);
    const preds = modelRef.current.predict(input);
    const data = preds.dataSync();
    input.dispose();
    preds.dispose();

    let maxIdx = 0;
    let maxVal = data[0];
    for (let i = 1; i < data.length; i++) {
      if (data[i] > maxVal) { maxVal = data[i]; maxIdx = i; }
    }
    return { label: SIGN_LABELS[maxIdx], confidence: maxVal };
  }

  // ── speakSign ─────────────────────────────────────────────────────────────
  const speakSign = useCallback((label) => {
    speak(label);
    setHistory(prev => [label, ...prev].slice(0, HISTORY_LIMIT));
  }, [speak]);

  // ── handleDwell ───────────────────────────────────────────────────────────
  const handleDwell = useCallback((label, confidence) => {
    setCurrentSign({ label, confidence });

    if (confidence < CONFIDENCE_THRESHOLD) {
      clearTimeout(dwellTimerRef.current);
      lastDwellLabelRef.current = null;
      return;
    }

    if (label !== lastDwellLabelRef.current) {
      clearTimeout(dwellTimerRef.current);
      lastDwellLabelRef.current = label;
      dwellTimerRef.current = setTimeout(() => {
        speakSign(label);
      }, DWELL_TIME_MS);
    }
  }, [speakSign]);

  // ── MediaPipe results handler ─────────────────────────────────────────────
  const handleResults = useCallback((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      currentLandmarksRef.current = results.multiHandLandmarks[0];
    } else {
      currentLandmarksRef.current = null;
      setCurrentSign(null);
      clearTimeout(dwellTimerRef.current);
      lastDwellLabelRef.current = null;
    }
  }, []);

  // ── initCamera ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadModel();
        const stream = await acquireCamera();
        hasCameraRef.current = true;
        if (cancelled) {
          releaseCamera();
          hasCameraRef.current = false;
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const hands = await getHandsInstance(handleResults);
        if (cancelled) return;
        handsRef.current = hands;

        const sendFrame = async () => {
          if (cancelled) return;
          if (videoRef.current && handsRef.current) {
            try { await handsRef.current.send({ image: videoRef.current }); } catch (_) {}
          }
          // Run classifier on latest landmarks
          if (currentLandmarksRef.current) {
            const result = classifyFrame(currentLandmarksRef.current);
            if (result) handleDwell(result.label, result.confidence);
          }
          animFrameRef.current = requestAnimationFrame(sendFrame);
        };
        animFrameRef.current = requestAnimationFrame(sendFrame);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();

    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
      clearTimeout(dwellTimerRef.current);
      if (videoRef.current) videoRef.current.srcObject = null;
      if (hasCameraRef.current) {
        releaseCamera();
        hasCameraRef.current = false;
      }
    };
  }, [handleResults, handleDwell, loadModel]);

  // ── UI ────────────────────────────────────────────────────────────────────
  const confidencePct = currentSign ? Math.round(currentSign.confidence * 100) : 0;
  const isAboveThreshold = currentSign && currentSign.confidence >= CONFIDENCE_THRESHOLD;

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: 20,
      zIndex: 9000,
      background: 'rgba(15, 17, 23, 0.92)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '12px 16px',
      minWidth: 200,
      maxWidth: 260,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      fontFamily: 'Inter, system-ui, sans-serif',
      userSelect: 'none'
    }}>
      {/* Hidden video for camera feed */}
      <video ref={videoRef} style={{ display: 'none' }} muted playsInline />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>🤟</span>
        <span className="text-os-text-secondary" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>
          SIGN LANGUAGE
        </span>
        {modelReady && (
          <span className="text-emerald-400"
            style={{
              marginLeft: 'auto', fontSize: 10, background: 'rgba(5, 150, 105, 0.2)',
              borderRadius: 99, padding: '2px 7px', fontWeight: 600
            }}>LIVE</span>
        )}
      </div>

      {modelError ? (
        <div className="text-red-400 text-xs" style={{ lineHeight: 1.5 }}>{modelError}</div>
      ) : error ? (
        <div className="text-red-400 text-xs" style={{ lineHeight: 1.5 }}>{error}</div>
      ) : !modelReady ? (
        <div className="text-os-text-secondary text-sm">Loading model…</div>
      ) : (
        <>
          {/* Detected sign */}
          <div className={isAboveThreshold ? 'text-indigo-400' : 'text-os-text-secondary'}
            style={{
              fontSize: 28, fontWeight: 800,
              marginBottom: 6, textAlign: 'center', letterSpacing: -1,
              transition: 'color 0.2s'
            }}>
            {isAboveThreshold ? currentSign.label : '—'}
          </div>

          {/* Confidence bar */}
          <div style={{ marginBottom: 10 }}>
            <div className="text-os-text-secondary flex justify-between text-[10px]" style={{ marginBottom: 3 }}>
              <span>Confidence</span>
              <span>{confidencePct}%</span>
            </div>
            <div className="bg-os-bg-secondary" style={{ height: 4, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${confidencePct}%`,
                background: isAboveThreshold ? '#7c3aed' : 'var(--theme-surface)',
                borderRadius: 99,
                transition: 'width 0.15s, background 0.2s'
              }} />
            </div>
          </div>

          {/* Last 5 emitted signs */}
          {history.length > 0 && (
            <div className="text-os-text-secondary text-xs"
              style={{
                borderTop: '1px solid var(--theme-border)',
                paddingTop: 8
              }}>
              <span style={{ marginRight: 4 }}>Recent:</span>
              {history.join(' · ')}
            </div>
          )}
        </>
      )}
    </div>
  );
}

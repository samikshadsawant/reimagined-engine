/**
 * SignDataCollector.jsx — Developer-only landmark data collection utility.
 *
 * Navigate to /dev/sign-collector to use this tool.
 * It collects 30 hand-landmark samples per ASL sign and exports
 * them as sign_training_data.json for use with trainClassifier.js.
 *
 * IMPORTANT: This component is NOT shown to end users.
 * It reuses the MediaPipe Hands instance from GestureController via a shared
 * camera context — it does NOT open a second getUserMedia stream.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SIGN_LABELS } from './signConfig';

const SAMPLES_PER_SIGN = 30;

// ── MediaPipe Hands bootstrap (shared camera, no duplicate getUserMedia) ──────
let sharedStream = null;
let handsInstance = null;

async function getSharedStream() {
  if (sharedStream && sharedStream.active) return sharedStream;
  sharedStream = await navigator.mediaDevices.getUserMedia({ video: true });
  return sharedStream;
}

async function initHands(onResults) {
  if (!window.Hands) {
    console.error('[SignDataCollector] MediaPipe Hands not loaded on window.Hands');
    return null;
  }
  if (handsInstance) {
    handsInstance.onResults(onResults);
    return handsInstance;
  }
  const hands = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5
  });
  hands.onResults(onResults);
  await hands.initialize();
  handsInstance = hands;
  return hands;
}
// ─────────────────────────────────────────────────────────────────────────────

export default function SignDataCollector() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const handsRef = useRef(null);
  const currentLandmarksRef = useRef(null);

  const [labelIdx, setLabelIdx] = useState(0);
  const [collected, setCollected] = useState({}); // { label: [[...21 landmarks...], ...] }
  const [status, setStatus] = useState('Initialising camera…');
  const [flash, setFlash] = useState(false);

  const currentLabel = SIGN_LABELS[labelIdx];

  // ── Landmark handler from MediaPipe ──────────────────────────────────────
  const handleResults = useCallback((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      currentLandmarksRef.current = results.multiHandLandmarks[0];
    } else {
      currentLandmarksRef.current = null;
    }
  }, []);

  // ── Camera & MediaPipe init ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stream = await getSharedStream();
        if (cancelled) return;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const hands = await initHands(handleResults);
        if (cancelled) return;
        handsRef.current = hands;

        setStatus(`Show sign: "${currentLabel}" — press Space to capture`);

        // Send frames to MediaPipe
        const sendFrame = async () => {
          if (cancelled) return;
          if (videoRef.current && handsRef.current) {
            try {
              await handsRef.current.send({ image: videoRef.current });
            } catch (_) {}
          }
          animFrameRef.current = requestAnimationFrame(sendFrame);
        };
        animFrameRef.current = requestAnimationFrame(sendFrame);
      } catch (err) {
        if (!cancelled) setStatus(`Camera error: ${err.message}`);
      }
    })();

    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [handleResults, currentLabel]);

  // ── Space bar → capture ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code !== 'Space' || e.target.tagName === 'INPUT') return;
      e.preventDefault();

      if (!currentLandmarksRef.current) {
        setStatus(`⚠️ No hand detected — hold your hand in frame and try again`);
        return;
      }

      const landmarks = currentLandmarksRef.current.map(({ x, y, z }) => ({ x, y, z: z ?? 0 }));

      setCollected(prev => {
        const existing = prev[currentLabel] || [];
        if (existing.length >= SAMPLES_PER_SIGN) {
          setStatus(`✅ "${currentLabel}" already has ${SAMPLES_PER_SIGN} samples`);
          return prev;
        }
        const updated = { ...prev, [currentLabel]: [...existing, landmarks] };
        const count = updated[currentLabel].length;

        // Flash feedback
        setFlash(true);
        setTimeout(() => setFlash(false), 180);

        if (count >= SAMPLES_PER_SIGN) {
          setStatus(`✅ "${currentLabel}" complete! Press → to move to the next sign.`);
        } else {
          setStatus(`[${count}/${SAMPLES_PER_SIGN}] Captured "${currentLabel}" — keep going!`);
        }
        return updated;
      });
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentLabel]);

  // ── Navigation between signs ─────────────────────────────────────────────
  const goNext = () => {
    if (labelIdx < SIGN_LABELS.length - 1) {
      const next = labelIdx + 1;
      setLabelIdx(next);
      setStatus(`Show sign: "${SIGN_LABELS[next]}" — press Space to capture`);
    }
  };
  const goPrev = () => {
    if (labelIdx > 0) {
      const prev = labelIdx - 1;
      setLabelIdx(prev);
      setStatus(`Show sign: "${SIGN_LABELS[prev]}" — press Space to capture`);
    }
  };

  // ── Export JSON ──────────────────────────────────────────────────────────
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(collected, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sign_training_data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Persist to localStorage ───────────────────────────────────────────────
  useEffect(() => {
    if (Object.keys(collected).length > 0) {
      for (const [label, samples] of Object.entries(collected)) {
        localStorage.setItem(`sign_data_${label}`, JSON.stringify(samples));
      }
    }
  }, [collected]);

  const totalCollected = Object.values(collected).reduce((s, v) => s + v.length, 0);
  const totalNeeded = SIGN_LABELS.length * SAMPLES_PER_SIGN;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--theme-bg)',
      color: 'var(--theme-text)',
      fontFamily: 'Inter, system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 16px',
      gap: 24
    }}>
      {/* Flash overlay */}
      {flash && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(255,255,255,0.15)',
          pointerEvents: 'none', zIndex: 9999
        }} />
      )}

      <h1 className="text-indigo-400" style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
        🤟 Sign Language Data Collector
      </h1>
      <p className="text-os-text-secondary" style={{ margin: 0, fontSize: 13 }}>
        Developer utility — not shown to end users
      </p>

      {/* Camera */}
      <div className="border-os-border" style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '2px solid' }}>
        <video ref={videoRef} width={480} height={360} style={{ display: 'block', transform: 'scaleX(-1)' }} muted />
        <canvas ref={canvasRef} width={480} height={360} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      </div>

      {/* Prompt */}
      <div className="bg-os-bg-secondary" style={{ borderRadius: 12, padding: '16px 32px', textAlign: 'center', minWidth: 320 }}>
        <div className="text-os-text-secondary" style={{ fontSize: 13, marginBottom: 4 }}>
          Sign {labelIdx + 1} of {SIGN_LABELS.length}
        </div>
        <div className="text-os-text-primary" style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>
          {currentLabel}
        </div>
        <div className="text-os-text-secondary" style={{ fontSize: 13, marginTop: 8 }}>{status}</div>
      </div>

      {/* Progress bars */}
      <div style={{ width: '100%', maxWidth: 480 }}>
        {SIGN_LABELS.map((label, i) => {
          const count = (collected[label] || []).length;
          const pct = Math.round((count / SAMPLES_PER_SIGN) * 100);
          return (
            <div key={label} style={{ marginBottom: 8 }}>
              <div className="flex justify-between text-xs" style={{ marginBottom: 3 }}>
                <span className={i === labelIdx ? 'text-indigo-400' : 'text-os-text-secondary'}>{label}</span>
                <span className={count >= SAMPLES_PER_SIGN ? 'text-emerald-400' : 'text-os-text-secondary'}>
                  {count}/{SAMPLES_PER_SIGN}
                </span>
              </div>
              <div className="bg-os-bg-secondary" style={{ height: 6, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: count >= SAMPLES_PER_SIGN ? '#34d399' : '#7c3aed',
                  borderRadius: 99, transition: 'width 0.2s'
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={goPrev} disabled={labelIdx === 0}
          style={btnStyle('#334155', labelIdx === 0)}>← Prev Sign</button>
        <button onClick={goNext} disabled={labelIdx === SIGN_LABELS.length - 1}
          style={btnStyle('#334155', labelIdx === SIGN_LABELS.length - 1)}>Next Sign →</button>
        <button onClick={exportJSON}
          style={btnStyle('#7c3aed', false)}>
          ⬇ Export JSON ({totalCollected}/{totalNeeded})
        </button>
      </div>

      {/* Instructions */}
      <div className="text-os-text-secondary" style={{ maxWidth: 480, fontSize: 12, textAlign: 'center', lineHeight: 1.7 }}>
        <strong className="text-os-text-primary">Instructions:</strong><br />
        1. Hold the displayed sign in front of your camera.<br />
        2. Press <kbd className="bg-os-bg-secondary px-1 py-0.5 rounded text-[10px]">Space</kbd> to capture a sample.<br />
        3. Collect {SAMPLES_PER_SIGN} samples per sign, then click Export JSON.<br />
        4. Place the exported file at <code>client/src/input/signLanguage/sign_training_data.json</code>.<br />
        5. Run <code>node trainClassifier.js</code> to train the model.
      </div>
    </div>
  );
}

function btnStyle(bg, disabled) {
  return {
    background: disabled ? '#1e293b' : bg,
    color: disabled ? '#475569' : '#f1f5f9',
    border: 'none', borderRadius: 8,
    padding: '10px 20px', fontSize: 13,
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity 0.15s',
    opacity: disabled ? 0.5 : 1
  };
}

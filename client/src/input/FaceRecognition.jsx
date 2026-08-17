/**
 * FaceRecognition.jsx — Phase 2.4
 *
 * Recognises known people via face-api.js running entirely in the browser.
 * No face data is ever sent to a cloud API — all inference is local.
 *
 * Model weights expected in client/public/models/ :
 *   tiny_face_detector_model-*      (face detection)
 *   face_landmark_68_model-*        (68-point landmarks)
 *   face_recognition_model-*        (128-d descriptor, 2 shards)
 *   face_expression_model-*         (expression classification — happy, sad, etc.)
 *
 * Recognition loop runs every 2000 ms (not every frame) to protect performance.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import useTTS from '../hooks/useTTS';

const MODELS_URL       = '/models';
const MATCH_THRESHOLD  = 0.5;   // face-api.js distance — lower = stricter
const LOOP_INTERVAL_MS = 2000;
const API_BASE         = '/api/known-book';

// ── Shared camera stream — uses centralized sharedCamera.js ──────────────────
import { acquireCamera, releaseCamera } from './sharedCamera';
// ─────────────────────────────────────────────────────────────────────────────

export default function FaceRecognition({ enabled = false }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const loopRef     = useRef(null);
  const hasCameraRef = useRef(false);

  const [modelsReady, setModelsReady] = useState(false);
  const [matches, setMatches]         = useState([]);  // [{ name, relationship, bbox }]
  const [error, setError]             = useState(null);
  const [knownPeople, setKnownPeople] = useState([]);  // from API
  // FIX 3B — undefined = unchecked, true = found, false = missing
  const [modelsExist, setModelsExist] = useState(undefined);

  const { speak } = useTTS();

  // ── Step A — Verify model files exist (once on mount) ─────────────────────
  // FIX 3B: HEAD request to detect missing files before attempting to load weights.
  // Avoids a cryptic CORS/404 cascade from face-api.js if models weren't placed in public/models/.
  useEffect(() => {
    fetch(`${MODELS_URL}/tiny_face_detector_model-weights_manifest.json`, { method: 'HEAD' })
      .then(res => {
        if (!res.ok) {
          console.error(
            '[FaceRecognition] face-api models not found at /models/ — ' +
            'place model files in public/models/ before using face recognition.'
          );
          setModelsExist(false);
          setError('Model files not found at /models/. See public/models/README.md for setup instructions.');
        } else {
          setModelsExist(true);
        }
      })
      .catch(() => {
        setModelsExist(false);
        setError('Could not reach /models/ — is the dev server running?');
      });
  }, []);

  // ── Step A — Load models (once per session, guarded by isLoaded) ────────────
  // FIX 3A: isLoaded guard ensures weights are fetched at most once even if
  // FaceRecognition is unmounted and remounted (e.g. Alzheimer phase toggle).
  useEffect(() => {
    // Wait until we have confirmed model files exist
    if (modelsExist !== true) return;
    (async () => {
      try {
        // Each net is guarded: skips the network fetch if already loaded in memory
        if (!faceapi.nets.tinyFaceDetector.isLoaded)
          await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
        if (!faceapi.nets.faceLandmark68Net.isLoaded)
          await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);
        if (!faceapi.nets.faceRecognitionNet.isLoaded)
          await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
        if (!faceapi.nets.faceExpressionNet.isLoaded)
          await faceapi.nets.faceExpressionNet.loadFromUri(MODELS_URL);  // expression model
        setModelsReady(true);
      } catch (err) {
        setError(`Model load failed: ${err.message}`);
      }
    })();
  }, [modelsExist]);  // re-runs only if modelsExist changes (i.e., never re-fetches weights)

  // ── Fetch known people from API ────────────────────────────────────────────
  const fetchKnownPeople = useCallback(async () => {
    try {
      const res  = await fetch(API_BASE, { credentials: 'include' });
      const data = await res.json();
      setKnownPeople(Array.isArray(data) ? data : []);
    } catch (_) {
      setKnownPeople([]);
    }
  }, []);

  useEffect(() => { fetchKnownPeople(); }, [fetchKnownPeople]);

  // ── Step B — Compute descriptor for a photo (called from KnownBookApp) ─────
  // Exposed as a static utility so KnownBookApp can call it when adding a person.
  // Usage: const descriptor = await FaceRecognition.computeDescriptor(imgElement)

  // ── Camera init ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !modelsReady) return;
    let cancelled = false;

    (async () => {
      try {
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
      } catch (err) {
        if (!cancelled) setError(`Camera error: ${err.message}`);
      }
    })();

    return () => {
      cancelled = true;
      if (videoRef.current) videoRef.current.srcObject = null;
      if (hasCameraRef.current) {
        releaseCamera();
        hasCameraRef.current = false;
      }
    };
  }, [enabled, modelsReady]);

  // ── Step C — Recognition loop (every 2000 ms) ──────────────────────────────
  useEffect(() => {
    if (!enabled || !modelsReady || !videoRef.current) return;

    const runLoop = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      // Build FaceMatcher from knownPeople descriptors
      const labeledDescriptors = knownPeople
        .filter(p => p.faceDescriptor)
        .map(p => {
          try {
            const arr = JSON.parse(p.faceDescriptor);
            const descriptor = new Float32Array(arr);
            return new faceapi.LabeledFaceDescriptors(p.id.toString(), [descriptor]);
          } catch { return null; }
        })
        .filter(Boolean);

      // Detect all faces in current video frame using TinyFaceDetector
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors()
        .withFaceExpressions();  // includes expression scores

      const canvas = canvasRef.current;
      if (canvas && videoRef.current) {
        faceapi.matchDimensions(canvas, videoRef.current);
      }

      const newMatches = [];

      for (const det of detections) {
        const { descriptor, detection, expressions } = det;
        const box = detection.box;

        // Top expression (e.g. "happy", "sad", "neutral"…)
        const topExpr = expressions
          ? Object.entries(expressions).sort((a, b) => b[1] - a[1])[0]
          : null;
        const exprLabel = topExpr && topExpr[1] > 0.5 ? topExpr[0] : null;

        if (labeledDescriptors.length > 0) {
          const matcher   = new faceapi.FaceMatcher(labeledDescriptors, MATCH_THRESHOLD);
          const bestMatch = matcher.findBestMatch(descriptor);

          if (bestMatch.distance < MATCH_THRESHOLD) {
            const personId = parseInt(bestMatch.label, 10);
            const person   = knownPeople.find(p => p.id === personId);
            if (person) {
              newMatches.push({
                name:         person.name,
                relationship: person.relationship,
                expression:   exprLabel,
                bbox:         { x: box.x, y: box.y, w: box.width, h: box.height }
              });

              // TTS announcement with expression
              const exprSuffix = exprLabel ? ` They look ${exprLabel}.` : '';
              speak(`This is ${person.name}, your ${person.relationship}.${exprSuffix}`);

              // Update recognition stats (fire-and-forget)
              fetch(`${API_BASE}/${person.id}`, {
                method:      'PUT',
                credentials: 'include',
                headers:     { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  recognitionCount: (person.recognitionCount || 0) + 1,
                  lastRecognized:   new Date().toISOString()
                })
              }).catch(() => {});
            }
          } else {
            newMatches.push({ name: 'Unknown person', relationship: '', expression: exprLabel, bbox: { x: box.x, y: box.y, w: box.width, h: box.height } });
          }
        } else {
          newMatches.push({ name: 'Unknown person', relationship: '', expression: exprLabel, bbox: { x: box.x, y: box.y, w: box.width, h: box.height } });
        }
      }

      setMatches(newMatches);
    };

    loopRef.current = setInterval(runLoop, LOOP_INTERVAL_MS);
    return () => clearInterval(loopRef.current);
  }, [enabled, modelsReady, knownPeople, speak]);

  if (!enabled) return null;

  // FIX 3B: visible warning when model files are not in public/models/
  if (modelsExist === false) {
    return (
      <div style={{
        width: 320, padding: '12px 14px',
        background: 'rgba(239,68,68,0.15)',
        border: '1px solid rgba(239,68,68,0.5)',
        borderRadius: 10, color: '#fca5a5',
        fontSize: 12, lineHeight: 1.5
      }}>
        <strong>⚠️ Face-api models missing</strong><br />
        {error}<br />
        <span style={{ opacity: 0.7 }}>
          Run the download script in <code>client/public/models/README.md</code>.
        </span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <video
        ref={videoRef}
        style={{ width: 320, height: 240, borderRadius: 10, display: 'block' }}
        muted playsInline
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      />

      {/* Face match overlays */}
      {matches.map((m, i) => (
        <div key={i} style={{
          position: 'absolute',
          left:   m.bbox.x,
          top:    m.bbox.y - 44,
          background: m.name === 'Unknown person' ? 'rgba(239,68,68,0.9)' : 'rgba(124,58,237,0.9)',
          color:  '#fff',
          fontSize: 11,
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 1
        }}>
          <span>{m.name}{m.relationship ? ` · ${m.relationship}` : ''}</span>
          {m.expression && (
            <span style={{ fontSize: 10, opacity: 0.85, fontWeight: 500 }}>
              😐 {m.expression}
            </span>
          )}
        </div>
      ))}

      {error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', color: '#f87171',
          fontSize: 11, padding: 12, borderRadius: 10, textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {!modelsReady && !error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', color: '#94a3b8', fontSize: 12, borderRadius: 10
        }}>
          Loading face models…
        </div>
      )}
    </div>
  );
}

/**
 * computeDescriptor — static utility used by KnownBookApp when saving a person.
 * Call after face-api.js models are loaded.
 *
 * @param {HTMLImageElement} imgEl
 * @returns {Promise<string|null>} JSON-serialised Float32Array, or null if no face found
 */
FaceRecognition.computeDescriptor = async function (imgEl) {
  try {
    // Ensure models are loaded before attempting detection
    if (!faceapi.nets.tinyFaceDetector.isLoaded) {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      ]);
    }
    const result = await faceapi
      .detectSingleFace(imgEl, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!result) return null;
    return JSON.stringify(Array.from(result.descriptor));
  } catch {
    return null;
  }
};

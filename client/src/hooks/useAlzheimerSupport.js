/**
 * useAlzheimerSupport.js — Phase 2.5
 *
 * Behaviour is gated by `alzheimerPhase` from the user's profile:
 *
 *   Phase 0   → Feature disabled, no hooks mounted
 *   Phase 1–2 → Known Book reminder every 30 min via TTS
 *   Phase 3–4 → Trigger face recognition on each new WindowFrame focus
 *   Phase 5   → Continuous face recognition; voice prompt for unknown faces
 *
 * Phase selector is only accessible to caregiver-role users.
 */

import { useEffect, useRef, useCallback } from 'react';
import useTTS from './useTTS';

const REMINDER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const API_BASE = '/api/known-book';

/**
 * @param {number} alzheimerPhase — from UserProfile (0–5)
 * @param {boolean} [isContinuousRecognitionActive] — pass true from parent
 *        when Phase 5 loop is already running (avoids double-starting)
 */
export default function useAlzheimerSupport(alzheimerPhase) {
  const { speak } = useTTS();
  const reminderTimerRef = useRef(null);
  const knownPeopleRef   = useRef([]);
  const reminderIdxRef   = useRef(0);

  // ── Fetch known people once ─────────────────────────────────────────────────
  const fetchKnown = useCallback(async () => {
    try {
      const res  = await fetch(API_BASE, { credentials: 'include' });
      const data = await res.json();
      knownPeopleRef.current = Array.isArray(data) ? data : [];
    } catch {
      knownPeopleRef.current = [];
    }
  }, []);

  // ── Phase 1–2: reminder every 30 minutes ───────────────────────────────────
  useEffect(() => {
    if (alzheimerPhase < 1 || alzheimerPhase > 2) return;

    fetchKnown();

    const fireReminder = () => {
      const people = knownPeopleRef.current;
      if (people.length === 0) return;

      const idx    = reminderIdxRef.current % people.length;
      const person = people[idx];
      reminderIdxRef.current = idx + 1;

      speak(`Remember, ${person.name} is your ${person.relationship}.`);
    };

    // Fire once immediately after a short delay, then on interval
    const initialDelay = setTimeout(fireReminder, 5000);
    reminderTimerRef.current = setInterval(fireReminder, REMINDER_INTERVAL_MS);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(reminderTimerRef.current);
    };
  }, [alzheimerPhase, speak, fetchKnown]);

  // ── Phase 3–4: trigger face recognition on WindowFrame focus events ─────────
  useEffect(() => {
    if (alzheimerPhase < 3 || alzheimerPhase > 4) return;

    const handleFocus = (e) => {
      // Dispatch a custom event that FaceRecognition listens for
      window.dispatchEvent(new CustomEvent('spiritos:facescan-trigger', {
        detail: { source: 'window-focus', target: e.target }
      }));
    };

    // Listen for window focus events on the OS-level window containers
    window.addEventListener('spiritos:window-focused', handleFocus);
    return () => window.removeEventListener('spiritos:window-focused', handleFocus);
  }, [alzheimerPhase]);

  // ── Phase 5: voice prompt for unknown faces ─────────────────────────────────
  useEffect(() => {
    if (alzheimerPhase !== 5) return;

    const handleUnknown = () => {
      speak("I don't recognise this person. Would you like to add them to your Known Book?");
    };

    window.addEventListener('spiritos:face-unknown', handleUnknown);
    return () => window.removeEventListener('spiritos:face-unknown', handleUnknown);
  }, [alzheimerPhase, speak]);

  return null;
}

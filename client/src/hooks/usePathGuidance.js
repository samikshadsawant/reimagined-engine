/**
 * usePathGuidance.js — Vision-impaired spacebar path-guidance hook.
 *
 * When the user presses Space (with no input focused), this hook enumerates
 * all focusable elements in the currently active WindowFrame and reads them
 * aloud via the useTTS hook with 400 ms pauses between items.
 *
 * Usage:
 *   const { isReading } = usePathGuidance(windowRef);
 *   // windowRef — React ref pointing to the window's root DOM node
 *
 * The hook also sets isReading=true for 100 ms so WindowFrame can render
 * a brief visual flash for low-vision feedback.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import useTTS from './useTTS';

// Selector for all navigable elements — do NOT broaden arbitrarily
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  '[role="button"]',
  '[role="menuitem"]',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

export default function usePathGuidance(windowRef) {
  const { speak } = useTTS();
  const [isReading, setIsReading] = useState(false);
  const readingRef = useRef(false);
  const timerRef = useRef(null);

  /** Query the window's own DOM subtree — not the entire document. */
  const getElements = useCallback(() => {
    const root = windowRef?.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR));
  }, [windowRef]);

  /**
   * Build a readable description for each element.
   * Priority: aria-label → title → innerText → tag name
   */
  const buildScript = useCallback((elements) => {
    return elements.map((el) => {
      const tag = el.tagName.toLowerCase();
      const label =
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        (el.innerText || '').trim().slice(0, 80) ||
        tag;
      const role = el.getAttribute('role') || tag;
      return `${role}: ${label}`;
    }).filter(Boolean);
  }, []);

  /**
   * Read each item in the script with a 400 ms pause between items.
   * Respects cancellation if another guidance pass is triggered.
   */
  const readScript = useCallback(async (script) => {
    readingRef.current = true;
    for (const text of script) {
      if (!readingRef.current) break;
      speak(text);
      await new Promise(res => setTimeout(res, 400));
    }
    readingRef.current = false;
  }, [speak]);

  /**
   * Space bar handler — only fires when body is the active element
   * (i.e., no input/textarea is focused).
   */
  const handleSpacebar = useCallback((e) => {
    if (e.code !== 'Space') return;
    const active = document.activeElement;
    if (active && active !== document.body &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' ||
         active.tagName === 'SELECT' || active.isContentEditable)) return;

    e.preventDefault();

    // Cancel any in-flight reading pass
    readingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);

    // Visual flash for 100 ms
    setIsReading(true);
    timerRef.current = setTimeout(() => setIsReading(false), 100);

    const elements = getElements();
    const script = buildScript(elements);
    if (script.length === 0) {
      speak('No interactive elements found in this window.');
    } else {
      readScript(script);
    }
  }, [getElements, buildScript, readScript, speak]);

  useEffect(() => {
    window.addEventListener('keydown', handleSpacebar);
    return () => {
      window.removeEventListener('keydown', handleSpacebar);
      readingRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleSpacebar]);

  return { isReading };
}

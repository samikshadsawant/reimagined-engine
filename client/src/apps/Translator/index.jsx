/**
 * Translator App for SpiritOS
 *
 * Features:
 *  - Text input translation
 *  - Voice input via Web Speech API
 *  - TTS output (speak the translation)
 *  - 20+ language support
 *  - Uses free MyMemory Translation API (no key needed)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { speak } from '../../hooks/useTTS'

// Supported languages (speech = BCP-47 locale for Web Speech API)
const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧', speech: 'en-US' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', speech: 'hi-IN' },
  { code: 'mr', name: 'Marathi', flag: '🇮🇳', speech: 'mr-IN' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', speech: 'es-ES' },
  { code: 'fr', name: 'French', flag: '🇫🇷', speech: 'fr-FR' },
  { code: 'de', name: 'German', flag: '🇩🇪', speech: 'de-DE' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', speech: 'it-IT' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', speech: 'pt-PT' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', speech: 'ru-RU' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', speech: 'ja-JP' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', speech: 'ko-KR' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳', speech: 'zh-CN' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', speech: 'ar-SA' },
  { code: 'bn', name: 'Bengali', flag: '🇧🇩', speech: 'bn-BD' },
  { code: 'ta', name: 'Tamil', flag: '🇮🇳', speech: 'ta-IN' },
  { code: 'te', name: 'Telugu', flag: '🇮🇳', speech: 'te-IN' },
  { code: 'gu', name: 'Gujarati', flag: '🇮🇳', speech: 'gu-IN' },
  { code: 'kn', name: 'Kannada', flag: '🇮🇳', speech: 'kn-IN' },
  { code: 'ml', name: 'Malayalam', flag: '🇮🇳', speech: 'ml-IN' },
  { code: 'pa', name: 'Punjabi', flag: '🇮🇳', speech: 'pa-IN' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰', speech: 'ur-PK' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷', speech: 'tr-TR' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱', speech: 'nl-NL' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪', speech: 'sv-SE' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱', speech: 'pl-PL' },
]

const LANGUAGE_ALIASES = {
  english: 'en',
  hindi: 'hi',
  marathi: 'mr',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  russian: 'ru',
  japanese: 'ja',
  korean: 'ko',
  chinese: 'zh',
  arabic: 'ar',
  bengali: 'bn',
  tamil: 'ta',
  telugu: 'te',
  gujarati: 'gu',
  kannada: 'kn',
  malayalam: 'ml',
  punjabi: 'pa',
  urdu: 'ur',
  turkish: 'tr',
  dutch: 'nl',
  swedish: 'sv',
  polish: 'pl'
}

function resolveLanguage(input) {
  if (!input || typeof input !== 'string') return null
  const normalized = input.toLowerCase().replace(/\blanguage\b/g, '').trim()
  if (!normalized) return null

  if (LANGUAGE_ALIASES[normalized]) return LANGUAGE_ALIASES[normalized]

  const match = LANGUAGES.find((lang) =>
    lang.code.toLowerCase() === normalized || lang.name.toLowerCase() === normalized
  )
  return match ? match.code : null
}

function Translator() {
  const [sourceText, setSourceText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('hi')
  const [isTranslating, setIsTranslating] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)

  // ── Translate via MyMemory API ──
  const translate = useCallback(async (text, overrides = {}) => {
    if (!text?.trim()) return
    setIsTranslating(true)
    setError('')

    try {
      const from = overrides.from || sourceLang
      const to = overrides.to || targetLang
      const langpair = `${from}|${to}`
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=${langpair}`
      const res = await fetch(url)
      const data = await res.json()

      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        const result = data.responseData.translatedText
        setTranslatedText(result)

        // Add to history
        setHistory(prev => [{
          source: text.trim(),
          result,
          from,
          to,
          time: new Date().toLocaleTimeString()
        }, ...prev].slice(0, 10))
      } else {
        setError(data.responseData?.translatedText || 'Translation failed')
      }
    } catch (err) {
      setError('Translation service unavailable. Check your internet.')
    } finally {
      setIsTranslating(false)
    }
  }, [sourceLang, targetLang])

  useEffect(() => {
    const handleTranslateRequest = (event) => {
      const detail = event?.detail || {}
      const text = typeof detail.text === 'string' ? detail.text.trim() : ''
      if (!text) return

      const from = resolveLanguage(detail.sourceLang) || sourceLang
      const to = resolveLanguage(detail.targetLang) || targetLang

      setSourceLang(from)
      setTargetLang(to)
      setSourceText(text)
      translate(text, { from, to })
    }

    window.addEventListener('spiritos:translate', handleTranslateRequest)
    return () => window.removeEventListener('spiritos:translate', handleTranslateRequest)
  }, [sourceLang, targetLang, translate])

  // ── Voice Input ──
  const lastTranscriptRef = useRef('')

  const startVoiceInput = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Voice input is not supported in this browser')
      return
    }

    // Get proper BCP-47 locale for speech recognition
    const langObj = LANGUAGES.find(l => l.code === sourceLang)
    const speechLocale = langObj?.speech || 'en-US'

    const recognition = new SpeechRecognition()
    recognition.lang = speechLocale
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => {
      setIsListening(true)
      setError('')
      lastTranscriptRef.current = ''
    }

    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setSourceText(transcript)
      lastTranscriptRef.current = transcript
    }

    recognition.onend = () => {
      setIsListening(false)
      // Auto-translate using the ref (not stale state)
      const text = lastTranscriptRef.current
      if (text.trim()) {
        translate(text)
      }
    }

    recognition.onerror = (e) => {
      setIsListening(false)
      if (e.error === 'network') {
        setError('Voice needs internet (Chrome sends audio to Google). Try typing instead.')
      } else if (e.error === 'not-allowed') {
        setError('Microphone access denied. Allow mic permission and try again.')
      } else if (e.error === 'no-speech') {
        setError('No speech detected. Try again and speak clearly.')
      } else {
        setError(`Voice error: ${e.error}`)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch (err) {
      setError('Failed to start voice input: ' + err.message)
    }
  }, [sourceLang, translate])

  const stopVoiceInput = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }, [])

  // ── Swap languages ──
  const swapLanguages = () => {
    setSourceLang(targetLang)
    setTargetLang(sourceLang)
    setSourceText(translatedText)
    setTranslatedText(sourceText)
  }

  // ── Speak translation ──
  const speakTranslation = () => {
    if (translatedText) speak(translatedText)
  }

  // ── Copy to clipboard ──
  const copyText = (text) => {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  const sourceLangObj = LANGUAGES.find(l => l.code === sourceLang)
  const targetLangObj = LANGUAGES.find(l => l.code === targetLang)

  return (
    <div className="h-full flex flex-col bg-os-bg-primary text-os-text-primary overflow-hidden">

      {/* Header */}
      <div className="px-5 py-3 border-b border-os-border flex items-center gap-3 flex-shrink-0">
        <span className="text-2xl">🌐</span>
        <div>
          <h1 className="text-base font-semibold">Language Translator</h1>
          <p className="text-[11px] text-os-text-secondary">Text & Voice • 25+ Languages</p>
        </div>
      </div>

      {/* Language Selector Row */}
      <div className="flex items-center gap-2 px-5 py-3 flex-shrink-0">
        {/* Source Language */}
        <div className="flex-1">
          <select
            value={sourceLang}
            onChange={e => setSourceLang(e.target.value)}
            className="w-full px-3 py-2 bg-os-surface border border-os-border rounded-lg text-sm text-os-text-primary outline-none focus:border-indigo-500/50 cursor-pointer appearance-none"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code} className="bg-os-bg-primary text-os-text-primary">
                {l.flag} {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Swap Button */}
        <button
          onClick={swapLanguages}
          className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center hover:bg-indigo-500/30 transition-all hover:scale-110 active:scale-95 flex-shrink-0"
          title="Swap languages"
        >
          <span className="material-symbols-outlined text-indigo-400 text-lg">swap_horiz</span>
        </button>

        {/* Target Language */}
        <div className="flex-1">
          <select
            value={targetLang}
            onChange={e => setTargetLang(e.target.value)}
            className="w-full px-3 py-2 bg-os-surface border border-os-border rounded-lg text-sm text-os-text-primary outline-none focus:border-indigo-500/50 cursor-pointer appearance-none"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code} className="bg-os-bg-primary text-os-text-primary">
                {l.flag} {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Translation Area */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 px-5 pb-3 overflow-hidden min-h-0">
        {/* Source */}
        <div className="flex-1 flex flex-col bg-os-surface/50 border border-os-border rounded-xl overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-os-border flex-shrink-0">
            <span className="text-xs text-os-text-secondary">{sourceLangObj?.flag} {sourceLangObj?.name}</span>
            <div className="flex items-center gap-1">
              {/* Voice Input Button */}
              <button
                onClick={isListening ? stopVoiceInput : startVoiceInput}
                className={`p-1.5 rounded-md transition-all ${
                  isListening
                    ? 'bg-red-500/20 text-red-400 animate-pulse'
                    : 'hover:bg-os-surface text-os-text-secondary hover:text-os-text-primary'
                }`}
                title={isListening ? 'Stop listening' : 'Voice input'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isListening ? 'mic_off' : 'mic'}
                </span>
              </button>
              <button
                onClick={() => copyText(sourceText)}
                className="p-1.5 rounded-md hover:bg-os-surface text-os-text-secondary hover:text-os-text-primary transition-all"
                title="Copy"
              >
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
              </button>
              <button
                onClick={() => { setSourceText(''); setTranslatedText(''); setError('') }}
                className="p-1.5 rounded-md hover:bg-os-surface text-os-text-secondary hover:text-os-text-primary transition-all"
                title="Clear"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
          <textarea
            value={sourceText}
            onChange={e => setSourceText(e.target.value)}
            placeholder="Type or speak to translate..."
            className="flex-1 bg-transparent px-4 py-3 text-sm text-os-text-primary placeholder-os-text-secondary resize-none outline-none min-h-0"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                translate(sourceText)
              }
            }}
          />
          <div className="px-3 py-2 border-t border-os-border flex items-center justify-between flex-shrink-0">
            <span className="text-[11px] text-os-text-secondary/60">{sourceText.length} chars</span>
            <button
              onClick={() => translate(sourceText)}
              disabled={!sourceText.trim() || isTranslating}
              className="px-4 py-1.5 bg-indigo-500/80 hover:bg-indigo-500 rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isTranslating ? '⏳ Translating...' : '🔄 Translate'}
            </button>
          </div>
        </div>

        {/* Result */}
        <div className="flex-1 flex flex-col bg-os-surface/50 border border-os-border rounded-xl overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-os-border flex-shrink-0">
            <span className="text-xs text-os-text-secondary">{targetLangObj?.flag} {targetLangObj?.name}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={speakTranslation}
                disabled={!translatedText}
                className="p-1.5 rounded-md hover:bg-os-surface text-os-text-secondary hover:text-os-text-primary transition-all disabled:opacity-20"
                title="Listen"
              >
                <span className="material-symbols-outlined text-[18px]">volume_up</span>
              </button>
              <button
                onClick={() => copyText(translatedText)}
                disabled={!translatedText}
                className="p-1.5 rounded-md hover:bg-os-surface text-os-text-secondary hover:text-os-text-primary transition-all disabled:opacity-20"
                title="Copy"
              >
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
              </button>
            </div>
          </div>
          <div className="flex-1 px-4 py-3 text-sm text-emerald-300/90 overflow-auto min-h-0">
            {isTranslating ? (
              <div className="flex items-center gap-2 text-os-text-secondary">
                <span className="animate-spin text-base">⏳</span> Translating...
              </div>
            ) : translatedText ? (
              <p className="whitespace-pre-wrap leading-relaxed">{translatedText}</p>
            ) : (
              <p className="text-os-text-secondary/30 italic">Translation will appear here...</p>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex-shrink-0">
          ⚠️ {error}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="px-5 pb-3 flex-shrink-0">
          <div className="text-[11px] text-os-text-secondary/60 mb-1.5">Recent translations</div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => {
                  setSourceText(h.source)
                  setTranslatedText(h.result)
                  setSourceLang(h.from)
                  setTargetLang(h.to)
                }}
                className="flex-shrink-0 px-3 py-1.5 bg-os-surface/50 border border-os-border rounded-lg text-[11px] text-os-text-secondary hover:text-os-text-primary hover:bg-os-surface transition-all max-w-[200px] truncate"
              >
                {h.source.substring(0, 25)}{h.source.length > 25 ? '...' : ''} → {h.result.substring(0, 20)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice Listening Overlay */}
      {isListening && (
        <div className="absolute inset-0 bg-backdrop backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
          <div className="text-center pointer-events-auto">
            <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-400 flex items-center justify-center animate-pulse mb-3 mx-auto">
              <span className="text-3xl">🎤</span>
            </div>
            <p className="text-os-text-primary text-sm">Listening in {sourceLangObj?.name}...</p>
            <button
              onClick={stopVoiceInput}
              className="mt-3 px-4 py-1.5 bg-red-500/80 rounded-lg text-xs font-medium hover:bg-red-500"
            >
              Stop
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Translator

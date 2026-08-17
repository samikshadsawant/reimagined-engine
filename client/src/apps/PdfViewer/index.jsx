/**
 * PDF Viewer Application
 * Premium PDF viewer with read-aloud, search, and page navigation
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import axios from 'axios'

function PdfViewer(props) {
  const windowProps = props.windowData?.props || props
  const { filePath, fileName } = windowProps
  const [pdfText, setPdfText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isReading, setIsReading] = useState(false)
  const [readingProgress, setReadingProgress] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [showSearch, setShowSearch] = useState(false)
  const [showReadPanel, setShowReadPanel] = useState(false)
  const [textLoading, setTextLoading] = useState(false)
  const [error, setError] = useState(null)
  const iframeRef = useRef(null)
  const speechRef = useRef(null)

  const pdfSrc = filePath ? `/api/fs/view?path=${encodeURIComponent(filePath)}` : null

  // Extract text for read-aloud and search
  const extractText = useCallback(async () => {
    if (!filePath || pdfText) return
    setTextLoading(true)
    try {
      const res = await axios.post('/api/search/parse', { path: filePath })
      setPdfText(res.data.text || '')
    } catch (err) {
      console.warn('PDF text extraction failed:', err.message)
      // Fallback: try the raw path
      try {
        const res = await axios.get(`/api/fs/read?path=${encodeURIComponent(filePath)}`)
        setPdfText(res.data.content || '')
      } catch {
        setPdfText('')
      }
    } finally {
      setTextLoading(false)
    }
  }, [filePath, pdfText])

  // Search within extracted text
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim() || !pdfText) {
      setSearchResults([])
      return
    }
    const query = searchQuery.toLowerCase()
    const text = pdfText.toLowerCase()
    const results = []
    let idx = 0
    let matchNum = 0
    while ((idx = text.indexOf(query, idx)) !== -1 && matchNum < 100) {
      const start = Math.max(0, idx - 40)
      const end = Math.min(pdfText.length, idx + query.length + 40)
      results.push({
        index: matchNum++,
        position: idx,
        context: '...' + pdfText.slice(start, end).replace(/\n/g, ' ') + '...'
      })
      idx += query.length
    }
    setSearchResults(results)
  }, [searchQuery, pdfText])

  useEffect(() => {
    handleSearch()
  }, [searchQuery, handleSearch])

  // Read Aloud using Web Speech API
  const startReading = useCallback(() => {
    if (!pdfText) {
      extractText().then(() => {
        // Will retry after text is loaded
      })
      return
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(pdfText)
      utterance.rate = 1.0
      utterance.pitch = 1.0

      // Try to use the stored voice preference
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        const preferred = voices.find(v => v.lang.startsWith('en')) || voices[0]
        utterance.voice = preferred
      }

      utterance.onboundary = (e) => {
        if (e.charIndex && pdfText.length) {
          setReadingProgress(Math.round((e.charIndex / pdfText.length) * 100))
        }
      }

      utterance.onend = () => {
        setIsReading(false)
        setReadingProgress(100)
      }

      utterance.onerror = () => {
        setIsReading(false)
      }

      speechRef.current = utterance
      window.speechSynthesis.speak(utterance)
      setIsReading(true)
    }
  }, [pdfText, extractText])

  const stopReading = useCallback(() => {
    window.speechSynthesis?.cancel()
    setIsReading(false)
    setReadingProgress(0)
  }, [])

  const pauseReading = useCallback(() => {
    if (window.speechSynthesis?.speaking) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
      } else {
        window.speechSynthesis.pause()
      }
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
    }
  }, [])

  if (!filePath) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
        <div className="text-center">
          <span className="text-4xl mb-3 block">📕</span>
          <p className="text-sm">No PDF selected</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Open a PDF from File Explorer</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        {/* Zoom */}
        <button
          onClick={() => setZoom(z => Math.max(25, z - 25))}
          className="p-1.5 rounded text-sm"
          style={{ color: 'var(--text-muted)' }}
          title="Zoom Out"
        >➖</button>
        <span className="text-xs tabular-nums min-w-[48px] text-center" style={{ color: 'var(--text)' }}>
          {zoom}%
        </span>
        <button
          onClick={() => setZoom(z => Math.min(400, z + 25))}
          className="p-1.5 rounded text-sm"
          style={{ color: 'var(--text-muted)' }}
          title="Zoom In"
        >➕</button>
        <button
          onClick={() => setZoom(100)}
          className="px-2 py-1 text-xs rounded"
          style={{ color: 'var(--text-muted)' }}
        >Reset</button>

        <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

        {/* Search toggle */}
        <button
          onClick={() => { setShowSearch(!showSearch); if (!pdfText) extractText() }}
          className="px-2 py-1 text-xs rounded transition-colors"
          style={{
            background: showSearch ? 'var(--accent-soft)' : 'transparent',
            color: showSearch ? 'var(--accent)' : 'var(--text-muted)'
          }}
          title="Search in PDF"
        >🔍 Search</button>

        {/* Read Aloud toggle */}
        <button
          onClick={() => {
            setShowReadPanel(!showReadPanel)
            if (!pdfText) extractText()
          }}
          className="px-2 py-1 text-xs rounded transition-colors"
          style={{
            background: showReadPanel ? 'var(--accent-soft)' : 'transparent',
            color: showReadPanel ? 'var(--accent)' : 'var(--text-muted)'
          }}
          title="Read Aloud"
        >🔊 Read Aloud</button>

        <div className="flex-1" />

        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{fileName}</span>
      </div>

      {/* Search Panel */}
      {showSearch && (
        <div className="px-3 py-2 border-b flex items-center gap-2" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
          <input
            type="text"
            placeholder="Search in document..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 rounded text-sm flex-1 focus:outline-none"
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
            autoFocus
          />
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {searchResults.length > 0 ? `${searchResults.length} matches` : textLoading ? 'Extracting...' : ''}
          </span>
        </div>
      )}

      {/* Search Results */}
      {showSearch && searchResults.length > 0 && (
        <div className="max-h-32 overflow-y-auto border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          {searchResults.slice(0, 20).map(r => (
            <div key={r.index} className="px-3 py-1.5 text-xs border-b hover:brightness-110 cursor-pointer" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--accent)' }}>#{r.index + 1}</span> {r.context}
            </div>
          ))}
        </div>
      )}

      {/* Read Aloud Panel */}
      {showReadPanel && (
        <div className="px-3 py-2 border-b flex items-center gap-2" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
          <button
            onClick={isReading ? stopReading : startReading}
            className="px-3 py-1.5 text-xs rounded font-medium"
            style={{
              background: isReading ? 'var(--danger)' : 'var(--accent)',
              color: '#fff'
            }}
          >
            {isReading ? '⏹ Stop' : '▶ Play'}
          </button>
          {isReading && (
            <button
              onClick={pauseReading}
              className="px-3 py-1.5 text-xs rounded"
              style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              ⏸ Pause
            </button>
          )}
          {isReading && (
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${readingProgress}%`, background: 'var(--accent)' }}
              />
            </div>
          )}
          {textLoading && (
            <span className="text-xs animate-pulse" style={{ color: 'var(--text-faint)' }}>Extracting text...</span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">✕</button>
        </div>
      )}

      {/* PDF iframe */}
      <div className="flex-1 overflow-hidden" style={{ background: '#525659' }}>
        {pdfSrc && (
          <iframe
            ref={iframeRef}
            src={pdfSrc}
            title={fileName || 'PDF'}
            className="w-full h-full border-none"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top left',
              width: `${10000 / zoom}%`,
              height: `${10000 / zoom}%`
            }}
          />
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-3 py-1 text-xs border-t" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-faint)' }}>
        <span>{fileName || 'Unknown'}</span>
        <span>{filePath}</span>
      </div>
    </div>
  )
}

export default PdfViewer

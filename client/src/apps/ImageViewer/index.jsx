/**
 * ImageViewer Application
 * Premium image viewer with zoom, rotate, and pan controls
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'

function ImageViewer(props) {
  const windowProps = props.windowData?.props || props
  const { filePath, fileName } = windowProps
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [fitMode, setFitMode] = useState(true) // fit-to-window vs actual size
  const [darkBg, setDarkBg] = useState(true)
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const imgRef = useRef(null)
  const containerRef = useRef(null)

  const imgSrc = filePath ? `/api/fs/view?path=${encodeURIComponent(filePath)}` : null

  const handleImageLoad = useCallback((e) => {
    setImgDimensions({ width: e.target.naturalWidth, height: e.target.naturalHeight })
    setLoading(false)
  }, [])

  const handleImageError = useCallback(() => {
    setError('Failed to load image')
    setLoading(false)
  }, [])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    setZoom(prev => {
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      return Math.max(0.1, Math.min(10, prev + delta))
    })
    setFitMode(false)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false })
      return () => container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  if (!filePath) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
        <div className="text-center">
          <span className="text-4xl mb-3 block">🖼️</span>
          <p className="text-sm">No image selected</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Open an image from File Explorer</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        {/* Zoom controls */}
        <button
          onClick={() => { setZoom(z => Math.max(0.1, z - 0.25)); setFitMode(false) }}
          className="p-1.5 rounded hover:brightness-125 text-sm"
          style={{ color: 'var(--text-muted)' }}
          title="Zoom Out"
        >➖</button>
        <span className="text-xs tabular-nums min-w-[48px] text-center" style={{ color: 'var(--text)' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => { setZoom(z => Math.min(10, z + 0.25)); setFitMode(false) }}
          className="p-1.5 rounded hover:brightness-125 text-sm"
          style={{ color: 'var(--text-muted)' }}
          title="Zoom In"
        >➕</button>

        <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

        {/* Fit toggle */}
        <button
          onClick={() => { setFitMode(!fitMode); if (!fitMode) setZoom(1) }}
          className="px-2 py-1 text-xs rounded transition-colors"
          style={{
            background: fitMode ? 'var(--accent-soft)' : 'transparent',
            color: fitMode ? 'var(--accent)' : 'var(--text-muted)',
            border: `1px solid ${fitMode ? 'var(--accent)' : 'transparent'}`
          }}
        >Fit</button>

        <button
          onClick={() => { setZoom(1); setFitMode(false) }}
          className="px-2 py-1 text-xs rounded"
          style={{ color: 'var(--text-muted)' }}
        >1:1</button>

        <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

        {/* Rotation */}
        <button
          onClick={() => setRotation(r => r - 90)}
          className="p-1.5 rounded text-sm"
          style={{ color: 'var(--text-muted)' }}
          title="Rotate Left"
        >↺</button>
        <button
          onClick={() => setRotation(r => r + 90)}
          className="p-1.5 rounded text-sm"
          style={{ color: 'var(--text-muted)' }}
          title="Rotate Right"
        >↻</button>

        <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

        {/* Background toggle */}
        <button
          onClick={() => setDarkBg(!darkBg)}
          className="px-2 py-1 text-xs rounded"
          style={{ color: 'var(--text-muted)' }}
          title="Toggle background"
        >{darkBg ? '🌙' : '☀️'}</button>

        <div className="flex-1" />

        {/* Image info */}
        {imgDimensions.width > 0 && (
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {imgDimensions.width} × {imgDimensions.height}
          </span>
        )}
      </div>

      {/* Image canvas */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-auto"
        style={{
          background: darkBg
            ? 'repeating-conic-gradient(#1a1a2e 0% 25%, #161624 0% 50%) 50% / 20px 20px'
            : 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 20px 20px'
        }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>Loading image...</div>
          </div>
        )}

        {error && (
          <div className="text-center">
            <span className="text-3xl block mb-2">⚠️</span>
            <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        )}

        {imgSrc && (
          <img
            ref={imgRef}
            src={imgSrc}
            alt={fileName || 'Image'}
            onLoad={handleImageLoad}
            onError={handleImageError}
            draggable={false}
            style={{
              transform: `rotate(${rotation}deg) scale(${fitMode ? 1 : zoom})`,
              transition: 'transform 0.15s ease',
              maxWidth: fitMode ? '100%' : 'none',
              maxHeight: fitMode ? '100%' : 'none',
              objectFit: fitMode ? 'contain' : 'none',
              imageRendering: zoom > 3 ? 'pixelated' : 'auto',
              opacity: loading ? 0 : 1
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

export default ImageViewer

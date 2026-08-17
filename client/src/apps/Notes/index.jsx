import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import useOsStore from '../../store/osStore'

function Notes({ content = '', filePath = '', fileName = '' }) {
  const userName = useOsStore((s) => s.userName)
  const [text, setText] = useState(content || '')
  const [currentFileName, setCurrentFileName] = useState(fileName || 'untitled.txt')
  const [currentFilePath, setCurrentFilePath] = useState(filePath || '')
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('') // 'saved', 'error', ''
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiResponse, setAiResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const textareaRef = useRef(null)
  const saveTimeoutRef = useRef(null)

  // Load content from props when they change
  useEffect(() => {
    if (content) {
      setText(content)
      setHasChanges(false)
    }
  }, [content])

  useEffect(() => {
    if (filePath) setCurrentFilePath(filePath)
    if (fileName) setCurrentFileName(fileName)
  }, [filePath, fileName])

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const lineCount = text.split('\n').length

  const handleChange = (e) => {
    setText(e.target.value)
    setHasChanges(true)
    setSaveStatus('')

    // Calculate cursor position
    const textarea = e.target
    const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart)
    const lines = textBeforeCursor.split('\n')
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1
    })

    // Auto-save after 3 seconds of no typing
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    if (currentFilePath) {
      saveTimeoutRef.current = setTimeout(() => {
        saveFile()
      }, 3000)
    }
  }

  const saveFile = async () => {
    if (!currentFilePath || saving) return

    setSaving(true)
    try {
      await axios.put('/api/fs/write', {
        path: currentFilePath,
        content: text
      })
      setHasChanges(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(''), 2000)
    } catch (err) {
      console.error('Save failed:', err)
      setSaveStatus('error')

      // If file doesn't exist yet, try creating it
      if (err.response?.status === 404) {
        try {
          const pathParts = currentFilePath.split('/')
          const name = pathParts.pop()
          const parentPath = pathParts.join('/') || '/'
          await axios.post('/api/fs/create', {
            path: parentPath,
            name: name,
            type: 'file',
            content: text
          })
          setHasChanges(false)
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus(''), 2000)
        } catch (createErr) {
          console.error('Create also failed:', createErr)
          setSaveStatus('error')
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAs = () => {
    const newName = prompt('Save as:', currentFileName)
    if (!newName) return

    const parentPath = currentFilePath
      ? currentFilePath.split('/').slice(0, -1).join('/') || '/'
      : '/'

    const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`

    setCurrentFileName(newName)
    setCurrentFilePath(newPath)

    // Create the file
    axios.post('/api/fs/create', {
      path: parentPath,
      name: newName,
      type: 'file',
      content: text
    }).then(() => {
      setHasChanges(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(''), 2000)
    }).catch(err => {
      console.error('Save As failed:', err)
      setSaveStatus('error')
    })
  }

  const handleNew = () => {
    if (hasChanges && !confirm('Discard unsaved changes?')) return
    setText('')
    setCurrentFileName('untitled.txt')
    setCurrentFilePath('')
    setHasChanges(false)
    setSaveStatus('')
  }

  const handleKeyDown = (e) => {
    // Ctrl+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      if (currentFilePath) {
        saveFile()
      } else {
        handleSaveAs()
      }
    }
    // Tab indentation
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = e.target
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newText = text.substring(0, start) + '  ' + text.substring(end)
      setText(newText)
      setHasChanges(true)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
    }
  }

  const askAI = async () => {
    if (!text.trim()) return
    setIsLoading(true)
    try {
      const response = await axios.post('/api/agent/chat', {
        message: `Explain or analyze this text: ${text.substring(0, 500)}`,
        osState: { userName }
      })
      setAiResponse(response.data.message)
      setAiPanelOpen(true)
    } catch (err) {
      setAiResponse('AI is not available right now.')
      setAiPanelOpen(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-os-bg-primary">
      {/* Top Toolbar */}
      <div className="h-12 flex items-center px-4 gap-2 bg-os-surface border-b border-os-border">
        <div className="flex items-center gap-1 bg-os-bg-secondary p-1 rounded-lg border border-os-border">
          <button onClick={handleNew} className="w-8 h-8 rounded flex items-center justify-center text-os-text-secondary hover:bg-os-bg-secondary hover:text-os-text-primary transition-colors" title="New">
            <span className="text-lg">📄</span>
          </button>
          <button onClick={handleSaveAs} className="w-8 h-8 rounded flex items-center justify-center text-os-text-secondary hover:bg-os-bg-secondary hover:text-os-text-primary transition-colors" title="Save As">
            <span className="text-lg">📂</span>
          </button>
          <button
            onClick={currentFilePath ? saveFile : handleSaveAs}
            disabled={saving || !hasChanges}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              hasChanges
                ? 'text-white bg-indigo-500/50 hover:bg-indigo-500'
                : 'text-os-text-secondary bg-os-bg-secondary/30'
            }`}
            title="Save (Ctrl+S)"
          >
            <span className="text-lg">{saving ? '⏳' : '💾'}</span>
          </button>
        </div>

        {/* File name */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-os-text-secondary font-mono truncate max-w-[200px]">{currentFileName}</span>
          {hasChanges && <span className="text-yellow-400 text-xs">●</span>}
          {saveStatus === 'saved' && <span className="text-green-400 text-xs">✓ Saved</span>}
          {saveStatus === 'error' && <span className="text-red-400 text-xs">✕ Error</span>}
        </div>

        <div className="flex-1" />

        {/* Ask AI Button */}
        <button
          onClick={askAI}
          disabled={isLoading || !text.trim()}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg transition-all duration-200 group disabled:opacity-50"
        >
          <span className="group-hover:scale-110 transition-transform">{isLoading ? '⏳' : '✨'}</span>
          <span className="text-sm font-semibold">Ask AI</span>
        </button>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Line Numbers */}
        <div className="w-12 flex-shrink-0 bg-os-bg-primary text-right pr-3 py-4 font-mono text-sm text-os-text-secondary border-r border-os-border select-none overflow-hidden">
          {text.split('\n').map((_, i) => (
            <div key={i} className="leading-[1.6]">{i + 1}</div>
          ))}
        </div>

        {/* Text Editor */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="flex-1 h-full p-4 bg-os-bg-primary font-mono text-sm text-os-text-primary leading-[1.6] outline-none resize-none"
          placeholder="Start typing or open a file from File Explorer..."
          spellCheck={false}
        />

        {/* AI Response Panel */}
        {aiPanelOpen && (
          <div className="w-80 border-l border-os-border flex flex-col bg-os-surface">
            <div className="flex items-center justify-between px-3 py-2 border-b border-os-border">
              <span className="text-xs text-os-text-secondary uppercase tracking-wider">AI Analysis</span>
              <button onClick={() => setAiPanelOpen(false)} className="text-os-text-secondary hover:text-os-text-primary">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 text-sm text-os-text-primary whitespace-pre-wrap">
              {aiResponse}
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="h-8 flex items-center justify-between px-4 bg-os-surface border-t border-os-border font-mono text-xs text-os-text-secondary select-none">
        <div className="flex items-center gap-4">
          <span className="hover:text-os-text-primary cursor-pointer transition-colors">UTF-8</span>
          <span className="hover:text-os-text-primary cursor-pointer transition-colors">
            {currentFileName.endsWith('.md') ? 'Markdown' :
             currentFileName.endsWith('.json') ? 'JSON' :
             currentFileName.endsWith('.js') || currentFileName.endsWith('.jsx') ? 'JavaScript' :
             currentFileName.endsWith('.html') ? 'HTML' :
             currentFileName.endsWith('.css') ? 'CSS' :
             currentFileName.endsWith('.py') ? 'Python' : 'Plain Text'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span>{wordCount} words</span>
          <span>{lineCount} lines</span>
          {currentFilePath && (
            <span className="text-os-text-secondary/50 truncate max-w-[200px]" title={currentFilePath}>{currentFilePath}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default Notes
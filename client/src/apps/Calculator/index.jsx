import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

const buttons = [
  ['AC', '( )', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '=']
]

function Calculator() {
  const [display, setDisplay] = useState('0')
  const [expression, setExpression] = useState('')
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(true)

  // Keyboard input handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      e.preventDefault()

      const key = e.key

      // Numbers
      if (/^[0-9]$/.test(key)) {
        handleNumber(key)
      }
      // Operators
      else if (key === '+' || key === '-' || key === '*' || key === '/') {
        handleOperator(key === '*' ? '×' : key === '/' ? '÷' : key)
      }
      // Decimal
      else if (key === '.') {
        handleNumber('.')
      }
      // Equals
      else if (key === 'Enter' || key === '=') {
        handleEquals()
      }
      // Clear
      else if (key === 'Escape' || key === 'c' || key === 'C') {
        handleOperator('AC')
      }
      // Backspace
      else if (key === 'Backspace') {
        if (display.length > 1) {
          setDisplay(prev => prev.slice(0, -1))
          setExpression(prev => prev.slice(0, -1))
        } else {
          setDisplay('0')
          setExpression(prev => prev.slice(0, -1))
        }
      }
      // Parentheses
      else if (key === '(' || key === ')') {
        handleOperator('( )')
      }
      // Percent
      else if (key === '%') {
        handleOperator('%')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [display, expression])

  const handleNumber = (num) => {
    if (num === '.' && display.includes('.')) return
    setDisplay(prev => prev === '0' ? num : prev + num)
    setExpression(prev => prev + num)
  }

  const handleOperator = (op) => {
    if (op === 'AC') {
      setDisplay('0')
      setExpression('')
      return
    }
    if (op === '%') {
      setDisplay(prev => String(parseFloat(prev) / 100))
      setExpression(prev => prev + '%')
      return
    }
    if (op === '( )') {
      if (expression.includes('(') && !expression.includes(')')) {
        setExpression(prev => prev + ')')
        setDisplay('0')
      } else {
        setExpression(prev => prev + '(')
        setDisplay('0')
      }
      return
    }
    setDisplay('0')
    setExpression(prev => prev + ' ' + op + ' ')
  }

  const handleEquals = () => {
    try {
      let expr = expression
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/\^/g, '**')
      if (!expr.trim()) return
      // Only digits, operators, parens, dots, %, ** and whitespace allowed.
      // Anything else means the user typed something we shouldn't evaluate.
      if (!/^[\d+\-*/().%\s*]+$/.test(expr)) {
        setDisplay('Error')
        return
      }
      // Indirect eval (Function constructor) — stricter scope than direct eval.
      const result = Function(`"use strict"; return (${expr});`)()
      const display = Number.isFinite(result) ? String(result) : 'Error'
      setDisplay(display)
      if (Number.isFinite(result)) {
        setHistory(prev => [{ expression, result: display }, ...prev.slice(0, 9)])
        setExpression(display)
      }
    } catch {
      setDisplay('Error')
    }
  }

  const handleHistoryClick = (item) => {
    setExpression(item.expression)
    setDisplay(item.result)
  }

  const getButtonClass = (btn, isNumber = false) => {
    const baseClass = isNumber
      ? 'rounded-lg hover:scale-95 active:scale-95 transition-all flex items-center justify-center shadow-sm border text-xl font-mono h-14'
      : 'rounded-lg hover:scale-95 active:scale-95 transition-all flex items-center justify-center shadow-sm border text-lg font-mono h-12'

    if (['÷', '×', '-', '+'].includes(btn)) {
      return `${baseClass} bg-os-bg-secondary text-blue-400 border-os-border hover:bg-os-surface`
    }
    if (btn === '=') {
      return `${baseClass} bg-indigo-500 text-white border-indigo-400 hover:bg-indigo-400 shadow-md shadow-indigo-500/20`
    }
    if (['AC', '( )', '%'].includes(btn)) {
      return `${baseClass} bg-os-surface text-red-400 border-os-border/50 hover:bg-os-bg-secondary`
    }
    // Number buttons
    return `${baseClass} bg-os-bg-secondary/50 text-os-text-primary border-os-border/30 hover:bg-os-surface/50`
  }

  return (
    <div className="h-full flex bg-os-bg-primary relative">
      {/* Calculator Main Area */}
      <div className="flex-1 flex flex-col p-3 gap-2">
        {/* Display Area */}
        <div className="h-24 bg-os-bg-secondary rounded-lg border border-os-border p-3 flex flex-col items-end justify-end relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="font-mono text-sm text-os-text-secondary mb-1 break-all opacity-80 tracking-wider w-full text-right overflow-hidden text-ellipsis">
            {expression || '\u00A0'}
          </div>
          <div className="font-mono text-4xl text-os-text-primary break-all tracking-tight">
            {display}
          </div>
        </div>

        {/* Keypad Grid */}
        <div className="grid grid-cols-4 gap-2 flex-1">
          {buttons.map((row, rowIndex) => (
            row.map((btn, btnIndex) => {
              const isNumber = !['÷', '×', '-', '+', '=', 'AC', '( )', '%'].includes(btn)
              return (
                <motion.button
                  key={`${rowIndex}-${btnIndex}`}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (['÷', '×', '-', '+'].includes(btn)) handleOperator(btn)
                    else if (btn === '=') handleEquals()
                    else if (['AC', '( )', '%'].includes(btn)) handleOperator(btn)
                    else handleNumber(btn)
                  }}
                  className={getButtonClass(btn, isNumber)}
                >
                  {btn}
                </motion.button>
              )
            })
          ))}
        </div>

        {/* Keyboard hint */}
        <div className="text-center text-xs text-os-text-secondary/50 mt-1">
          Use keyboard: 0-9, +, -, *, /, Enter, Escape
        </div>
      </div>

      {/* History Panel - Toggleable */}
      {showHistory && (
        <div className="w-36 flex flex-col bg-os-bg-primary/50 backdrop-blur-sm border-l border-os-border">
          <div
            className="p-2 border-b border-os-border flex items-center justify-between cursor-pointer hover:bg-os-surface/50"
            onClick={() => setShowHistory(false)}
          >
            <span className="text-xs text-os-text-secondary uppercase tracking-wider">History</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setHistory([])
              }}
              className="text-os-text-secondary hover:text-os-text-primary transition-colors text-xs"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {history.length === 0 ? (
              <div className="text-center text-os-text-secondary/50 text-xs py-4">No history</div>
            ) : (
              history.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleHistoryClick(item)}
                  className="p-1.5 rounded hover:bg-os-surface transition-colors cursor-pointer group text-right"
                >
                  <div className="font-mono text-[10px] text-os-text-secondary opacity-70 group-hover:opacity-100 transition-opacity truncate">{item.expression}</div>
                  <div className="font-mono text-xs text-os-text-primary font-medium mt-0.5 group-hover:text-indigo-400 transition-colors">{item.result}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* History Toggle Button (when hidden) */}
      {!showHistory && (
        <button
          onClick={() => setShowHistory(true)}
          className="absolute right-2 top-2 w-8 h-8 rounded-full bg-os-surface border border-os-border flex items-center justify-center text-xs text-os-text-secondary hover:bg-os-bg-secondary hover:text-os-text-primary transition-all"
          title="Show History"
        >
          📜
        </button>
      )}

      {/* Peace Sign Badge */}
      <div className="absolute bottom-3 left-3 bg-os-bg-secondary border border-os-border rounded-full px-2 py-1 flex items-center gap-1.5 shadow-lg z-10 opacity-70 hover:opacity-100 transition-opacity cursor-help">
        <span className="text-xs">✌️</span>
        <span className="font-mono text-[10px] text-os-text-secondary">Calculator</span>
      </div>
    </div>
  )
}

export default Calculator
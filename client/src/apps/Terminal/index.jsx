/**
 * Smart Terminal for SpiritOS
 *
 * Translates plain English input into real system commands.
 * Naive users can type "show my ip address" and it runs `ipconfig`.
 *
 * Also supports raw commands for advanced users.
 */

import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import useOsStore from '../../store/osStore'

// ── ASCII Banner ──
const asciiBanner = `
  ____        _      _ _    ___  ____
 / ___| _ __ (_)_ __(_) |_ / _ \\/ ___|
 \\___ \\| '_ \\| | '__| | __| | | \\___ \\
  ___) | |_) | | |  | | |_| |_| |___) |
 |____/| .__/|_|_|  |_|\\__|\\___/|____/
       |_|

`

const systemInfo = `Welcome to SpiritOS v1.0.4 — Smart Terminal
Type commands in plain English or use standard commands.
Type "help" for a list of commands.

System load:  0.01 | Memory: 12% | Disk: 42.1%
`

// ── English → Command mapping ──
// Each entry: { patterns: [...regex], cmd: "actual command", help: "description" }
const SMART_COMMANDS = [
  // Network
  { patterns: [/\b(ip\s*addr|ip\s*address|my\s*ip|what.*(is|s)\s*my\s*ip|show\s*ip|network\s*info)\b/i], cmd: 'ipconfig', help: 'Show IP address / network info' },
  { patterns: [/\b(ping)\s+(\S+)/i], cmd: 'ping -n 4 $2', help: 'Ping a host' },
  { patterns: [/\b(dns|name\s*server|nslookup)\s+(\S+)/i], cmd: 'nslookup $2', help: 'DNS lookup' },
  { patterns: [/\b(trace\s*route|tracert)\s+(\S+)/i], cmd: 'tracert $2', help: 'Trace route to host' },
  { patterns: [/\b(network\s*connections|open\s*ports|listening\s*ports|who.*(connected|listening))\b/i], cmd: 'netstat -an', help: 'Show network connections' },
  { patterns: [/\b(wifi\s*(status|info|details)|wireless)\b/i], cmd: 'netsh wlan show interfaces', help: 'Show WiFi status' },

  // System Info
  { patterns: [/\b(system\s*info|computer\s*info|about\s*(this\s*)?(computer|system|pc)|specs)\b/i], cmd: 'systeminfo | findstr /C:"OS Name" /C:"OS Version" /C:"System Type" /C:"Total Physical Memory"', help: 'Show system information' },
  { patterns: [/\b(hostname|computer\s*name|what.*(is|s)\s*(this\s*)?(computer|machine)\s*name)\b/i], cmd: 'hostname', help: 'Show computer name' },
  { patterns: [/\b(who\s*am\s*i|current\s*user|logged\s*in\s*(as|user)|my\s*user\s*name)\b/i], cmd: 'whoami', help: 'Show current user' },
  { patterns: [/\b(uptime|how\s*long.*(running|up|on))\b/i], cmd: 'net statistics workstation | findstr "since"', help: 'Show system uptime' },
  { patterns: [/\b(time|what\s*time|current\s*time|date\s*and\s*time)\b/i], cmd: 'echo %date% %time%', help: 'Show current date and time' },
  { patterns: [/\b(date|today.*(date|day)|what\s*day)\b/i], cmd: 'date /t', help: 'Show current date' },

  // Disk & Files
  { patterns: [/\b(disk\s*(space|usage|info|size)|free\s*space|storage|how\s*much\s*(space|storage))\b/i], cmd: 'wmic logicaldisk get size,freespace,caption', help: 'Show disk space' },
  { patterns: [/\b(list\s*(files|dir|folder|directory|content)|show\s*(files|folder)|what.*(in|inside)\s*(this\s*)?(folder|dir))\b/i], cmd: 'dir', help: 'List files in current directory' },
  { patterns: [/\b(folder\s*size|directory\s*size)\b/i], cmd: 'dir /s /-c | findstr "File(s)"', help: 'Show folder size' },
  { patterns: [/\b(find\s*file|search\s*(for\s*)?file|where\s*is)\s+(\S+)/i], cmd: 'dir /s /b *$3*', help: 'Search for a file' },

  // Process
  { patterns: [/\b(running\s*(apps|programs|process|tasks)|task\s*list|show\s*(tasks|processes)|what.*(running|open))\b/i], cmd: 'tasklist /fo table | more', help: 'Show running processes' },
  { patterns: [/\b(kill|stop|end|terminate|close)\s+(process|task|app|program)\s+(\S+)/i], cmd: 'taskkill /im $3 /f', help: 'Kill a process' },
  { patterns: [/\b(cpu\s*(usage|load)|processor\s*(usage|load))\b/i], cmd: 'wmic cpu get loadpercentage', help: 'Show CPU usage' },

  // Memory
  { patterns: [/\b(memory|ram)\s*(usage|info|status|available|free)\b/i], cmd: 'wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /format:list', help: 'Show memory usage' },

  // User Management
  { patterns: [/\b(all\s*users|user\s*accounts|list\s*users|show\s*users)\b/i], cmd: 'net user', help: 'List all user accounts' },

  // Misc
  { patterns: [/\b(battery|power\s*status|charge)\b/i], cmd: 'WMIC Path Win32_Battery Get EstimatedChargeRemaining', help: 'Show battery level' },
  { patterns: [/\b(clear|cls)\b/i], cmd: '__CLEAR__', help: 'Clear terminal screen' },
  { patterns: [/\b(help|commands|what\s*can\s*(i|you)\s*do)\b/i], cmd: '__HELP__', help: 'Show available commands' },
  { patterns: [/\b(echo|print|say)\s+(.+)/i], cmd: 'echo $2', help: 'Print text' },
  { patterns: [/\b(version|os\s*version)\b/i], cmd: 'ver', help: 'Show OS version' },
  { patterns: [/\b(shutdown|turn\s*off|power\s*off)\b/i], cmd: '__BLOCKED__', help: 'Shutdown (blocked for safety)' },
  { patterns: [/\b(restart|reboot)\b/i], cmd: '__BLOCKED__', help: 'Restart (blocked for safety)' },
]

/**
 * Match user input to a smart command
 * Returns { cmd, matched, original }
 */
function matchCommand(input) {
  const trimmed = input.trim()

  for (const entry of SMART_COMMANDS) {
    for (const pattern of entry.patterns) {
      const match = trimmed.match(pattern)
      if (match) {
        // Replace capture group placeholders ($2, $3, etc)
        let cmd = entry.cmd
        for (let i = 1; i < match.length; i++) {
          cmd = cmd.replace(`$${i}`, match[i] || '')
        }
        return { cmd: cmd.trim(), matched: true, original: trimmed, help: entry.help }
      }
    }
  }

  // If no match, treat as raw command
  return { cmd: trimmed, matched: false, original: trimmed }
}

function Terminal() {
  const [history, setHistory] = useState([])
  const [input, setInput] = useState('')
  const [commandHistory, setCommandHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isRunning, setIsRunning] = useState(false)
  const outputRef = useRef(null)
  const inputRef = useRef(null)

  const { userName } = useOsStore()

  useEffect(() => {
    addOutput(asciiBanner, 'banner')
    addOutput(systemInfo, 'info')
  }, [])

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [history])

  const addOutput = (text, type = 'output') => {
    setHistory(prev => [...prev, { text, type }])
  }

  const showHelp = () => {
    const lines = [
      '╔══════════════════════════════════════════════════════════╗',
      '║              SpiritOS Smart Terminal Help                ║',
      '╠══════════════════════════════════════════════════════════╣',
      '║  You can type in plain English! Examples:               ║',
      '╠══════════════════════════════════════════════════════════╣',
      '║                                                         ║',
      '║  🌐 Network:                                            ║',
      '║    "show my ip address"    → ipconfig                   ║',
      '║    "ping google.com"       → ping -n 4 google.com       ║',
      '║    "wifi status"           → netsh wlan show interfaces ║',
      '║    "open ports"            → netstat -an                ║',
      '║                                                         ║',
      '║  💻 System:                                             ║',
      '║    "system info"           → systeminfo                 ║',
      '║    "who am i"              → whoami                     ║',
      '║    "computer name"         → hostname                   ║',
      '║    "what time is it"       → echo %date% %time%        ║',
      '║                                                         ║',
      '║  📁 Files:                                              ║',
      '║    "list files"            → dir                        ║',
      '║    "disk space"            → wmic logicaldisk ...       ║',
      '║    "find file readme"      → dir /s /b *readme*        ║',
      '║                                                         ║',
      '║  ⚙️  Process:                                           ║',
      '║    "running apps"          → tasklist                   ║',
      '║    "cpu usage"             → wmic cpu get load...       ║',
      '║    "memory usage"          → wmic OS get memory...     ║',
      '║                                                         ║',
      '║  🔧 Other:                                              ║',
      '║    "battery"               → battery level              ║',
      '║    "all users"             → net user                   ║',
      '║    "clear"                 → clear screen               ║',
      '║    "ai [question]"         → ask AI assistant           ║',
      '║                                                         ║',
      '║  💡 Or type any raw command directly!                   ║',
      '╚══════════════════════════════════════════════════════════╝',
    ]
    addOutput(lines.join('\n'), 'output')
  }

  const executeCommand = async (rawInput) => {
    const { cmd, matched, original } = matchCommand(rawInput)

    addOutput(`${userName}@spiritos:~$ ${rawInput}`, 'command')

    // Show translation hint if English was detected
    if (matched && cmd !== '__CLEAR__' && cmd !== '__HELP__' && cmd !== '__BLOCKED__') {
      addOutput(`  ↳ Translated to: ${cmd}`, 'hint')
    }

    // Handle built-ins
    if (cmd === '__CLEAR__') { setHistory([]); return }
    if (cmd === '__HELP__') { showHelp(); return }
    if (cmd === '__BLOCKED__') { addOutput('⛔ This command is blocked for safety in the demo environment.', 'error'); return }

    // Handle AI queries
    if (rawInput.trim().toLowerCase().startsWith('ai ')) {
      const query = rawInput.trim().substring(3)
      try {
        addOutput('🤖 Thinking...', 'info')
        const aiRes = await axios.post('/api/agent/chat', { message: query, osState: { userName } })
        addOutput(`🤖 ${aiRes.data.message}`, 'output')
      } catch {
        addOutput('🤖 AI assistant is unavailable right now.', 'error')
      }
      return
    }

    // Execute via server
    setIsRunning(true)
    try {
      const response = await axios.post('/api/terminal/exec', { command: cmd })
      const { stdout, stderr, exitCode } = response.data

      if (stdout && stdout.trim()) {
        addOutput(stdout.trim(), 'output')
      }
      if (stderr && stderr.trim()) {
        addOutput(stderr.trim(), 'error')
      }
      if (!stdout && !stderr) {
        addOutput(`Command completed (exit code: ${exitCode})`, 'info')
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      addOutput(`Error: ${msg}`, 'error')
    } finally {
      setIsRunning(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && input.trim() && !isRunning) {
      setCommandHistory(prev => [...prev, input])
      setHistoryIndex(-1)
      executeCommand(input)
      setInput('')
    } else if (e.key === 'ArrowUp' && commandHistory.length > 0) {
      e.preventDefault()
      const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex
      setHistoryIndex(newIndex)
      setInput(commandHistory[commandHistory.length - 1 - newIndex] || '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '')
      } else {
        setHistoryIndex(-1); setInput('')
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      // Simple tab completion from smart commands
      const trimmed = input.trim().toLowerCase()
      if (trimmed) {
        const match = SMART_COMMANDS.find(sc =>
          sc.patterns.some(p => p.test(trimmed))
        )
        if (match) {
          addOutput(`💡 Hint: "${trimmed}" → ${match.cmd.replace(/__\w+__/, match.help)}`, 'hint')
        }
      }
    }
  }

  const getTextClass = (type) => {
    const map = {
      command: 'text-emerald-400/70',
      error: 'text-red-400',
      info: 'text-cyan-400/80',
      banner: 'text-emerald-400/90',
      output: 'text-emerald-300',
      hint: 'text-yellow-400/60 italic text-xs'
    }
    return map[type] || 'text-emerald-300'
  }

  return (
    <div className="h-full flex flex-col bg-os-bg-primary" onClick={() => inputRef.current?.focus()}>
      {/* Terminal output */}
      <div ref={outputRef} className="flex-1 p-4 overflow-y-auto font-mono text-sm leading-relaxed terminal-glow custom-scrollbar">
        {history.map((line, i) => (
          <pre key={i} className={`whitespace-pre-wrap mb-1 selection:bg-emerald-500/30 selection:text-emerald-300 ${getTextClass(line.type)}`}>{line.text}</pre>
        ))}

        {/* Prompt */}
        <div className="flex items-center mt-1">
          <span className="text-indigo-400 font-bold">{userName}@spiritos</span>
          <span className="text-os-text-secondary">:</span>
          <span className="text-cyan-400 font-bold">~</span>
          <span className="text-os-text-secondary">$ </span>
          <span className="text-emerald-300 whitespace-pre">{input}</span>
          <span className={`w-2 h-4 inline-block ml-0.5 ${isRunning ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400/80 animate-pulse'}`}></span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="absolute opacity-0 pointer-events-auto"
        autoFocus
        disabled={isRunning}
      />

      <style>{`
        .terminal-glow { text-shadow: 0 0 3px rgba(16,185,129,0.3); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(10,10,15,0.5); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>
    </div>
  )
}

export default Terminal

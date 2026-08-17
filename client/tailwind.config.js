export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Core palette — soft lavender system
        'os-bg':          '#dde1f9',
        'os-surface':     'rgba(255,255,255,0.72)',
        'os-text':        '#1a1a3e',
        'os-text-muted':  '#6b6b9a',
        'os-text-hint':   '#9898bb',
        'os-accent':      '#5b5fc7',
        'os-accent-soft': '#eeeeff',
        'os-border':      'rgba(255,255,255,0.55)',

        // Semantic
        'os-danger':  '#ef4444',
        'os-warning': '#f59e0b',
        'os-success': '#10b981',

        // Agent colors for AI overlay
        'agent-file':      '#3b82f6',
        'agent-system':    '#f59e0b',
        'agent-knowledge': '#a855f7',
        'agent-assistant': '#6b7280',

        // Legacy aliases so no other component breaks
        'os-bg-primary':       '#dde1f9',
        'os-bg-secondary':     'rgba(255,255,255,0.72)',
        'os-bg-tertiary':      'rgba(255,255,255,0.55)',
        'os-bg-elevated':      'rgba(255,255,255,0.88)',
        'os-text-primary':     '#1a1a3e',
        'os-text-secondary':   '#6b6b9a',
        'os-text-tertiary':    '#9898bb',
        'os-accent-light':     '#8486e8',
        'os-accent-dark':      '#4446b0',
        'os-accent-muted':     'rgba(91,95,199,0.15)',
        'primary':             '#5b5fc7',
        'surface':             'rgba(255,255,255,0.72)',
        'on-surface':          '#1a1a3e',
        'os-info':             '#3b82f6',
        'os-info-muted':       'rgba(59,130,246,0.12)',
        'os-danger-muted':     'rgba(239,68,68,0.12)',
        'os-warning-muted':    'rgba(245,158,11,0.12)',
        'os-success-muted':    'rgba(16,185,129,0.12)',
      },
      fontFamily: {
        sans:            ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono:            ['"JetBrains Mono"', 'monospace'],
        'display-lg':    ['"DM Sans"', 'system-ui', 'sans-serif'],
        'body-xl':       ['"DM Sans"', 'system-ui', 'sans-serif'],
        'body-large':    ['"DM Sans"', 'system-ui', 'sans-serif'],
        'body-normal':   ['"DM Sans"', 'system-ui', 'sans-serif'],
        'window-title':  ['"DM Sans"', 'system-ui', 'sans-serif'],
        'mono-label':    ['"JetBrains Mono"', 'monospace'],
        'terminal-text': ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        'DEFAULT': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        'full': '9999px',
      },
      boxShadow: {
        'window': '0 20px 60px rgba(80,80,180,0.18), 0 2px 8px rgba(0,0,0,0.06)',
        'dock':   '0 4px 24px rgba(80,80,180,0.14)',
        'panel':  '0 8px 32px rgba(80,80,180,0.10)',
        'glow':   '0 0 20px rgba(91,95,199,0.20)',
      },
      spacing: {
        'taskbar-height':    '56px',
        'window-min-width':  '300px',
        'window-min-height': '200px',
      },
    },
  },
  plugins: [],
}
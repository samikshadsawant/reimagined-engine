import { useEffect } from 'react'
import useOsStore from '../store/osStore'

/**
 * Custom hook to apply theme, accessibility profile, and CSS variables
 */
function useAccessibility() {
  const { profile, fontSize, fontWeight, contrast, cursorSize, theme } = useOsStore()

  useEffect(() => {
    const root = document.documentElement
    const body = document.body

    // Apply theme as body class (for CSS selectors)
    body.classList.remove('theme-dark', 'theme-light')
    body.classList.add(`theme-${theme}`)

    // Font size scaling via CSS variable
    const fontSizeMap = {
      normal: '1',
      large: '1.25',
      xl: '1.5'
    }
    root.style.setProperty('--font-scale', fontSizeMap[fontSize] || '1')

    const fontWeightMap = {
      normal: '400',
      medium: '500',
      bold: '600'
    }
    root.style.setProperty('--font-weight', fontWeightMap[fontWeight] || '400')

    // High contrast mode
    if (contrast === 'high') {
      body.classList.add('high-contrast')
    } else {
      body.classList.remove('high-contrast')
    }

    // Cursor size
    if (cursorSize === 'large') {
      body.classList.add('cursor-large')
    } else {
      body.classList.remove('cursor-large')
    }

    // Animations reduced for certain profiles
    if (profile === 'elderly' || profile === 'visually-impaired') {
      body.classList.add('reduced-animations')
    } else {
      body.classList.remove('reduced-animations')
    }

  }, [profile, fontSize, fontWeight, contrast, cursorSize, theme])
}

export default useAccessibility
import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Dev-only hash route: /#/dev/sign-collector → renders SignDataCollector
// This is NOT shown in production (no bundle impact — lazy loaded)
function Root() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (hash === '#/dev/sign-collector') {
    const SignDataCollector = React.lazy(() => import('./input/signLanguage/SignDataCollector'))
    return (
      <React.Suspense fallback={<div style={{ color: '#fff', padding: 32 }}>Loading collector…</div>}>
        <SignDataCollector />
      </React.Suspense>
    )
  }

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />)
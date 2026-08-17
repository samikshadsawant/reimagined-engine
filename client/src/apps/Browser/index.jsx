/**
 * Browser Application
 * Opens URLs in the system default browser with real favicons
 */

import React, { useState } from 'react'
import { Search, Home, Globe, ExternalLink, Trash2, History, Grid, Play, ShoppingBag, Newspaper, Code, Film } from 'lucide-react'

// Website data with real favicon URLs
const QUICK_LINKS = {
  all: [
    { name: 'Google', url: 'https://www.google.com', favicon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64' },
    { name: 'YouTube', url: 'https://www.youtube.com', favicon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64' },
    { name: 'GitHub', url: 'https://github.com', favicon: 'https://www.google.com/s2/favicons?domain=github.com&sz=64' },
    { name: 'Wikipedia', url: 'https://www.wikipedia.org', favicon: 'https://www.google.com/s2/favicons?domain=wikipedia.org&sz=64' },
    { name: 'Reddit', url: 'https://reddit.com', favicon: 'https://www.google.com/s2/favicons?domain=reddit.com&sz=64' },
    { name: 'Twitter', url: 'https://twitter.com', favicon: 'https://www.google.com/s2/favicons?domain=twitter.com&sz=64' },
    { name: 'Gmail', url: 'https://mail.google.com', favicon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64' },
    { name: 'Amazon', url: 'https://www.amazon.com', favicon: 'https://www.google.com/s2/favicons?domain=amazon.com&sz=64' },
    { name: 'LinkedIn', url: 'https://www.linkedin.com', favicon: 'https://www.google.com/s2/favicons?domain=linkedin.com&sz=64' },
    { name: 'Netflix', url: 'https://www.netflix.com', favicon: 'https://www.google.com/s2/favicons?domain=netflix.com&sz=64' },
    { name: 'Spotify', url: 'https://open.spotify.com', favicon: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=64' },
    { name: 'Discord', url: 'https://discord.com', favicon: 'https://www.google.com/s2/favicons?domain=discord.com&sz=64' }
  ],
  social: [
    { name: 'Twitter', url: 'https://twitter.com', favicon: 'https://www.google.com/s2/favicons?domain=twitter.com&sz=64' },
    { name: 'Facebook', url: 'https://facebook.com', favicon: 'https://www.google.com/s2/favicons?domain=facebook.com&sz=64' },
    { name: 'Instagram', url: 'https://instagram.com', favicon: 'https://www.google.com/s2/favicons?domain=instagram.com&sz=64' },
    { name: 'Reddit', url: 'https://reddit.com', favicon: 'https://www.google.com/s2/favicons?domain=reddit.com&sz=64' },
    { name: 'Discord', url: 'https://discord.com', favicon: 'https://www.google.com/s2/favicons?domain=discord.com&sz=64' },
    { name: 'LinkedIn', url: 'https://www.linkedin.com', favicon: 'https://www.google.com/s2/favicons?domain=linkedin.com&sz=64' },
    { name: 'WhatsApp', url: 'https://whatsapp.com', favicon: 'https://www.google.com/s2/favicons?domain=whatsapp.com&sz=64' },
    { name: 'Telegram', url: 'https://telegram.org', favicon: 'https://www.google.com/s2/favicons?domain=telegram.org&sz=64' }
  ],
  shopping: [
    { name: 'Amazon', url: 'https://www.amazon.com', favicon: 'https://www.google.com/s2/favicons?domain=amazon.com&sz=64' },
    { name: 'eBay', url: 'https://www.ebay.com', favicon: 'https://www.google.com/s2/favicons?domain=ebay.com&sz=64' },
    { name: 'Flipkart', url: 'https://www.flipkart.com', favicon: 'https://www.google.com/s2/favicons?domain=flipkart.com&sz=64' },
    { name: 'Myntra', url: 'https://www.myntra.com', favicon: 'https://www.google.com/s2/favicons?domain=myntra.com&sz=64' },
    { name: 'Snapdeal', url: 'https://www.snapdeal.com', favicon: 'https://www.google.com/s2/favicons?domain=snapdeal.com&sz=64' },
    { name: 'Shopify', url: 'https://www.shopify.com', favicon: 'https://www.google.com/s2/favicons?domain=shopify.com&sz=64' }
  ],
  news: [
    { name: 'BBC', url: 'https://www.bbc.com', favicon: 'https://www.google.com/s2/favicons?domain=bbc.com&sz=64' },
    { name: 'CNN', url: 'https://www.cnn.com', favicon: 'https://www.google.com/s2/favicons?domain=cnn.com&sz=64' },
    { name: 'NYT', url: 'https://www.nytimes.com', favicon: 'https://www.google.com/s2/favicons?domain=nytimes.com&sz=64' },
    { name: 'Hindustan', url: 'https://www.hindustantimes.com', favicon: 'https://www.google.com/s2/favicons?domain=hindustantimes.com&sz=64' },
    { name: 'NDTV', url: 'https://www.ndtv.com', favicon: 'https://www.google.com/s2/favicons?domain=ndtv.com&sz=64' },
    { name: 'Aaj Tak', url: 'https://www.aajtak.in', favicon: 'https://www.google.com/s2/favicons?domain=aajtak.in&sz=64' }
  ],
  dev: [
    { name: 'GitHub', url: 'https://github.com', favicon: 'https://www.google.com/s2/favicons?domain=github.com&sz=64' },
    { name: 'Stack Overflow', url: 'https://stackoverflow.com', favicon: 'https://www.google.com/s2/favicons?domain=stackoverflow.com&sz=64' },
    { name: 'W3Schools', url: 'https://www.w3schools.com', favicon: 'https://www.google.com/s2/favicons?domain=w3schools.com&sz=64' },
    { name: 'NPM', url: 'https://www.npmjs.com', favicon: 'https://www.google.com/s2/favicons?domain=npmjs.com&sz=64' },
    { name: 'Medium', url: 'https://medium.com', favicon: 'https://www.google.com/s2/favicons?domain=medium.com&sz=64' },
    { name: 'DEV', url: 'https://dev.to', favicon: 'https://www.google.com/s2/favicons?domain=dev.to&sz=64' },
    { name: 'CodePen', url: 'https://codepen.io', favicon: 'https://www.google.com/s2/favicons?domain=codepen.io&sz=64' },
    { name: 'MDN', url: 'https://developer.mozilla.org', favicon: 'https://www.google.com/s2/favicons?domain=developer.mozilla.org&sz=64' }
  ],
  entertainment: [
    { name: 'YouTube', url: 'https://www.youtube.com', favicon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64' },
    { name: 'Netflix', url: 'https://www.netflix.com', favicon: 'https://www.google.com/s2/favicons?domain=netflix.com&sz=64' },
    { name: 'Spotify', url: 'https://open.spotify.com', favicon: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=64' },
    { name: 'Disney+', url: 'https://www.disneyplus.com', favicon: 'https://www.google.com/s2/favicons?domain=disneyplus.com&sz=64' },
    { name: 'Hotstar', url: 'https://www.hotstar.com', favicon: 'https://www.google.com/s2/favicons?domain=hotstar.com&sz=64' },
    { name: 'Prime Video', url: 'https://www.primevideo.com', favicon: 'https://www.google.com/s2/favicons?domain=primevideo.com&sz=64' },
    { name: 'Twitch', url: 'https://www.twitch.tv', favicon: 'https://www.google.com/s2/favicons?domain=twitch.tv&sz=64' },
    { name: 'IMDb', url: 'https://www.imdb.com', favicon: 'https://www.google.com/s2/favicons?domain=imdb.com&sz=64' }
  ]
}

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Grid },
  { id: 'social', label: 'Social', icon: Play },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'dev', label: 'Dev', icon: Code },
  { id: 'entertainment', label: 'Entertainment', icon: Film }
]

function Browser() {
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState([
    { name: 'Wikipedia', url: 'https://www.wikipedia.org' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'YouTube', url: 'https://www.youtube.com' },
    { name: 'Reddit', url: 'https://reddit.com' }
  ])
  const [history, setHistory] = useState([])
  const [activeCategory, setActiveCategory] = useState('all')

  const getFavicon = (url) => {
    try {
      const domain = new URL(url).hostname
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    } catch {
      return null
    }
  }

  const openUrl = (url) => {
    if (url !== 'about:blank') {
      setHistory(prev => {
        const newHistory = [{ url, title: getTitleFromUrl(url), time: Date.now() }, ...prev.filter(h => h.url !== url)].slice(0, 50)
        return newHistory
      })
    }
    window.open(url, '_blank')
  }

  const handleSearch = (e) => {
    e?.preventDefault()
    if (!searchQuery.trim()) return

    let url = searchQuery.trim()
    if (url.includes('.') && !url.includes(' ')) {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url
      }
    } else {
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`
    }
    openUrl(url)
    setSearchQuery('')
  }

  const getTitleFromUrl = (url) => {
    try {
      if (url.includes('google.com/search')) return 'Google Search'
      const hostname = new URL(url).hostname.replace('www.', '')
      return hostname
    } catch {
      return url
    }
  }

  const removeFavorite = (url) => {
    setFavorites(favorites.filter(f => f.url !== url))
  }

  const clearHistory = () => setHistory([])

  return (
    <div className="h-full flex flex-col bg-os-bg-primary">
      {/* Header */}
      <div className="p-4 bg-os-surface/80 border-b border-os-border">
        {/* Title */}
        <div className="flex items-center justify-center mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center mr-2.5 shadow-lg shadow-primary/20">
            <Globe size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-os-text-primary">Browser</h1>
            <p className="text-[10px] text-os-text-secondary">Opens in default browser</p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="max-w-lg mx-auto">
          <div className="flex items-center bg-os-surface-hover border border-os-border rounded-lg px-3 py-2 transition-all focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
            <Search size={16} className="text-os-text-secondary mr-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or enter URL..."
              className="flex-1 outline-none text-sm bg-transparent text-os-text-primary placeholder:text-os-text-secondary"
            />
            <button
              type="submit"
              className="ml-2 px-2.5 py-1 bg-primary hover:bg-primary/80 text-white text-xs font-medium rounded-md transition-colors"
            >
              Go
            </button>
          </div>
        </form>

        {/* Quick Actions */}
        <div className="flex justify-center gap-0.5 mt-2">
          <button
            onClick={() => openUrl('about:blank')}
            className="flex items-center gap-1 px-2 py-1 text-os-text-secondary hover:text-os-text-primary hover:bg-os-surface-hover rounded-md transition-all text-xs"
          >
            <Home size={12} />
            <span>Home</span>
          </button>
          <div className="relative group">
            <button className="flex items-center gap-1 px-2 py-1 text-os-text-secondary hover:text-os-text-primary hover:bg-os-surface-hover rounded-md transition-all text-xs">
              <Globe size={12} />
              <span>Favorites</span>
            </button>
            {/* Favorites Dropdown */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-64 bg-os-surface border border-os-border rounded-lg shadow-xl z-50 hidden group-hover:block">
              <div className="p-2.5 border-b border-os-border flex justify-between items-center">
                <span className="text-xs font-medium text-os-text-secondary uppercase">Favorites</span>
              </div>
              <div className="max-h-44 overflow-y-auto py-1">
                {favorites.map((fav) => (
                  <div
                    key={fav.url}
                    onClick={() => openUrl(fav.url)}
                    className="flex items-center justify-between px-3 py-2 hover:bg-os-surface-hover cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <img src={getFavicon(fav.url)} alt="" className="w-4 h-4 rounded" onError={(e) => e.target.style.display = 'none'} />
                      <span className="text-sm text-os-text-primary">{fav.name}</span>
                    </div>
                    <span
                      onClick={(e) => { e.stopPropagation(); removeFavorite(fav.url) }}
                      className="text-os-text-secondary hover:text-red-400 p-1 cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </span>
                  </div>
                ))}
                {favorites.length === 0 && (
                  <div className="px-3 py-3 text-center text-os-text-secondary text-xs">No favorites</div>
                )}
              </div>
            </div>
          </div>
          <div className="relative group">
            <button className="flex items-center gap-1 px-2 py-1 text-os-text-secondary hover:text-os-text-primary hover:bg-os-surface-hover rounded-md transition-all text-xs">
              <History size={12} />
              <span>History</span>
            </button>
            {/* History Dropdown */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-64 bg-os-surface border border-os-border rounded-lg shadow-xl z-50 hidden group-hover:block">
              <div className="p-2.5 border-b border-os-border flex justify-between items-center">
                <span className="text-xs font-medium text-os-text-secondary uppercase">History</span>
                {history.length > 0 && (
                  <button onClick={clearHistory} className="text-xs text-red-400 hover:text-red-300">Clear</button>
                )}
              </div>
              <div className="max-h-44 overflow-y-auto py-1">
                {history.slice(0, 10).map((item, i) => (
                  <div
                    key={i}
                    onClick={() => openUrl(item.url)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-os-surface-hover cursor-pointer"
                  >
                    <img src={getFavicon(item.url)} alt="" className="w-4 h-4 rounded" onError={(e) => e.target.style.display = 'none'} />
                    <span className="text-sm text-os-text-primary truncate">{item.title}</span>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="px-3 py-3 text-center text-os-text-secondary text-xs">No history</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Category Tabs */}
        <div className="flex gap-1 mb-5 flex-wrap justify-center">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeCategory === cat.id
                    ? 'bg-primary text-white'
                    : 'bg-os-surface-hover text-os-text-secondary hover:text-os-text-primary'
                }`}
              >
                <Icon size={12} />
                {cat.label}
              </button>
            )
          })}
        </div>

        {/* Links Grid */}
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-2">
            {QUICK_LINKS[activeCategory]?.map((link) => (
              <div
                key={link.name}
                onClick={() => openUrl(link.url)}
                className="group flex flex-col items-center p-3 rounded-lg bg-os-surface hover:bg-os-surface-hover border border-os-border hover:border-primary/30 transition-all cursor-pointer hover:scale-[1.02]"
              >
                <img
                  src={link.favicon}
                  alt={link.name}
                  className="w-8 h-8 rounded-lg mb-2 object-contain bg-white"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
                <span className="text-xs text-os-text-primary font-medium truncate w-full text-center">{link.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Favorites Section */}
        {favorites.length > 0 && (
          <div className="max-w-2xl mx-auto mt-6">
            <h3 className="text-xs font-medium text-os-text-secondary uppercase tracking-wider mb-2 px-1">Your Favorites</h3>
            <div className="flex flex-wrap gap-2">
              {favorites.map((fav) => (
                <div
                  key={fav.url}
                  onClick={() => openUrl(fav.url)}
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-os-surface hover:bg-os-surface-hover rounded-full border border-os-border hover:border-primary/30 cursor-pointer transition-all group"
                >
                  <img src={getFavicon(fav.url)} alt="" className="w-4 h-4 rounded" onError={(e) => e.target.style.display = 'none'} />
                  <span className="text-xs text-os-text-primary">{fav.name}</span>
                  <span
                    onClick={(e) => { e.stopPropagation(); removeFavorite(fav.url) }}
                    className="opacity-0 group-hover:opacity-100 text-os-text-secondary hover:text-red-400"
                  >
                    <Trash2 size={10} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="max-w-2xl mx-auto mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-os-surface rounded-lg text-os-text-secondary text-xs">
            <ExternalLink size={12} />
            <span>Click any link to open in your default browser</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Browser
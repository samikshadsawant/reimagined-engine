/**
 * useSystemInfo Hook
 * Gets real-time system information from the browser
 * - Battery status
 * - Network status
 * - Memory info (if available)
 */

import { useState, useEffect } from 'react'

const DEFAULT_INFO = {
  batteryLevel: 100,
  charging: true,
  chargingTime: 0,
  dischargingTime: Infinity,
  online: true,
  memory: null,
  platform: navigator.platform
}

export default function useSystemInfo() {
  const [systemInfo, setSystemInfo] = useState(DEFAULT_INFO)

  useEffect(() => {
    // Get initial values
    const updateBattery = async () => {
      try {
        if ('getBattery' in navigator) {
          const battery = await navigator.getBattery()

          const updateFromBattery = () => {
            setSystemInfo(prev => ({
              ...prev,
              batteryLevel: Math.round(battery.level * 100),
              charging: battery.charging,
              chargingTime: battery.chargingTime,
              dischargingTime: battery.dischargingTime
            }))
          }

          // Initial update
          updateFromBattery()

          // Listen for changes
          battery.addEventListener('levelchange', updateFromBattery)
          battery.addEventListener('chargingchange', updateFromBattery)
          battery.addEventListener('chargingtimechange', updateFromBattery)
          battery.addEventListener('dischargingtimechange', updateFromBattery)
        }
      } catch (err) {
        console.log('Battery API not available:', err.message)
      }
    }

    // Network status
    const updateNetwork = () => {
      setSystemInfo(prev => ({
        ...prev,
        online: navigator.onLine
      }))
    }

    // Memory info (Chrome only)
    const updateMemory = () => {
      if (navigator.deviceMemory) {
        setSystemInfo(prev => ({
          ...prev,
          memory: navigator.deviceMemory
        }))
      }
    }

    updateBattery()
    updateNetwork()
    updateMemory()

    // Listen for network changes
    window.addEventListener('online', updateNetwork)
    window.addEventListener('offline', updateNetwork)

    return () => {
      window.removeEventListener('online', updateNetwork)
      window.removeEventListener('offline', updateNetwork)
    }
  }, [])

  return systemInfo
}

/**
 * Format battery time in minutes to readable string
 */
export function formatTime(minutes) {
  if (!isFinite(minutes) || minutes === Infinity) return 'calculating...'
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}
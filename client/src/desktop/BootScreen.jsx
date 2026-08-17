/**
 * BootScreen — SpiritOS startup splash
 *
 * A short branded splash that fades into the desktop. We don't play any
 * startup audio so people in shared spaces, hospitals or libraries aren't
 * disturbed when SpiritOS loads.
 */
import React, { useEffect } from 'react'

const SPLASH_MS = 1200

export default function BootScreen({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, SPLASH_MS)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center transition-opacity duration-500"
      style={{
        background: 'linear-gradient(140deg,#e4e8fc 0%,#d8dcf8 35%,#e8d5f0 70%,#f0e8fa 100%)'
      }}
    >
      <div className="flex flex-col items-center gap-4 select-none">
        <div
          className="w-20 h-20 rounded-[28px] flex items-center justify-center shadow-2xl"
          style={{ background: 'linear-gradient(135deg,#7c6ff7 0%,#c084fc 100%)' }}
        >
          <span className="text-white text-4xl font-bold">S</span>
        </div>

        <div className="text-center">
          <h1
            className="text-4xl font-semibold tracking-tight"
            style={{ color: '#4a4fb0', fontFamily: 'DM Sans, sans-serif' }}
          >
            SpiritOS
          </h1>
          <p className="text-sm text-[#7b7fc4] mt-1">
            Accessible Computing for Everyone
          </p>
        </div>

        <div className="mt-6 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[#7c6ff7] animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

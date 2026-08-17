import React from 'react'
import { motion } from 'framer-motion'
import { ICON_STYLES } from '../config/appConfig'

function DesktopIcon({ name, appKey, onOpen }) {
  const style = ICON_STYLES[appKey] || { from: '#6b7280', to: '#4b5563', icon: '◻' }

  return (
    <motion.div
      className="flex flex-col items-center gap-2 cursor-pointer w-[72px]"
      whileHover={{ scale: 1.08, y: -3 }}
      whileTap={{ scale: 0.92 }}
      onClick={onOpen}
    >
      <div
        className="w-[52px] h-[52px] squircle flex items-center justify-center text-white text-2xl shadow-md select-none"
        style={{ background: `linear-gradient(145deg, ${style.from}, ${style.to})` }}
      >
        {style.icon}
      </div>
      <span className="text-[11.5px] font-medium text-os-text text-center leading-tight drop-shadow-sm select-none max-w-full truncate">
        {name}
      </span>
    </motion.div>
  )
}

export default DesktopIcon
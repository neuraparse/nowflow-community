'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CopilotCharacter, type CopilotMood } from '@/components/branding/copilot-character'

const TIPS = [
  'I can help you build workflows in seconds.',
  'Connect 200+ tools with drag & drop.',
  'Deploy as API, chat, or embedded UI.',
  'Your AI-powered workflow assistant.',
  'Let me guide you through the builder.',
  'Ship products faster with agentic workflows.',
  "Need help? I'm always here for you.",
  'Automate complex tasks effortlessly.',
]

export default function HeroMascot() {
  const [currentMood, setCurrentMood] = useState<CopilotMood>('idle')
  const [isHovered, setIsHovered] = useState(false)
  const [tipIndex, setTipIndex] = useState(0)

  // Cycle moods
  useEffect(() => {
    const moods: CopilotMood[] = [
      'happy',
      'excited',
      'love',
      'playful',
      'wink',
      'curious',
      'proud',
      'thinking',
      'mischievous',
      'confident',
    ]

    let index = 0
    const interval = setInterval(() => {
      index++
      setCurrentMood(moods[index % moods.length])
    }, 3500)

    const initial = setTimeout(() => setCurrentMood('happy'), 600)

    return () => {
      clearInterval(interval)
      clearTimeout(initial)
    }
  }, [])

  // Rotate tip text each time user hovers
  const handleMouseEnter = () => {
    setIsHovered(true)
    setTipIndex((prev) => (prev + 1) % TIPS.length)
    setCurrentMood('happy')
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
  }

  return (
    <div
      className="relative inline-flex items-center justify-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover dialog bubble */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute bottom-full mb-3 right-0 z-30"
          >
            <div className="relative bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.06] rounded-xl px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] w-[200px]">
              <p className="text-[11px] text-zinc-600 dark:text-white/70 leading-relaxed font-medium">
                {TIPS[tipIndex]}
              </p>
              {/* Arrow pointing down-right */}
              <div className="absolute -bottom-[5px] right-5 w-2.5 h-2.5 bg-white dark:bg-slate-900 border-r border-b border-black/[0.08] dark:border-white/[0.06] rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle glow behind mascot */}
      <motion.div
        className="absolute inset-0 -m-4 rounded-full bg-gradient-to-br from-teal-500/10 to-emerald-500/10 dark:from-teal-400/5 dark:to-emerald-400/5 blur-xl"
        animate={{ opacity: isHovered ? 1 : 0.6 }}
        transition={{ duration: 0.3 }}
      />

      {/* Copilot */}
      <CopilotCharacter
        size={62}
        interactive
        mood={currentMood}
        className="text-zinc-700 dark:text-white/70 relative z-10 cursor-pointer"
      />
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef } from 'react'

type Star = {
  x: number
  y: number
  radius: number
  baseOpacity: number
  twinkleSpeed: number
  twinkleOffset: number
  color: string
  glowRadius: number
}

type ShootingStar = {
  x: number
  y: number
  vx: number
  vy: number
  length: number
  life: number
  maxLife: number
  color: string
}

type Nebula = {
  x: number
  y: number
  radius: number
  color: string
  opacity: number
  driftX: number
  driftY: number
}

const STAR_COLORS = ['#ffffff', '#e0e7ff', '#c4d5f7', '#ffd6a5', '#ffe4f0', '#d4f0e8']
const STAR_COUNT = 200
const MOUSE_RADIUS = 200

export default function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const starsRef = useRef<Star[]>([])
  const shootingStarsRef = useRef<ShootingStar[]>([])
  const nebulaeRef = useRef<Nebula[]>([])
  const rafRef = useRef<number>(0)
  const timeRef = useRef(0)

  const init = useCallback((w: number, h: number) => {
    // Stars
    const stars: Star[] = []
    for (let i = 0; i < STAR_COUNT; i++) {
      const isBright = Math.random() < 0.12
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: isBright ? Math.random() * 2.0 + 1.0 : Math.random() * 1.0 + 0.2,
        baseOpacity: isBright ? Math.random() * 0.4 + 0.5 : Math.random() * 0.35 + 0.08,
        twinkleSpeed: Math.random() * 0.025 + 0.004,
        twinkleOffset: Math.random() * Math.PI * 2,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        glowRadius: isBright ? Math.random() * 8 + 4 : 0,
      })
    }
    starsRef.current = stars

    // Nebulae (soft colored clouds)
    const nebulae: Nebula[] = [
      {
        x: w * 0.2,
        y: h * 0.3,
        radius: w * 0.25,
        color: 'rgba(74, 122, 104, 0.035)',
        opacity: 1,
        driftX: 0.08,
        driftY: 0.04,
      },
      {
        x: w * 0.75,
        y: h * 0.5,
        radius: w * 0.3,
        color: 'rgba(59, 130, 246, 0.025)',
        opacity: 1,
        driftX: -0.06,
        driftY: 0.03,
      },
      {
        x: w * 0.5,
        y: h * 0.7,
        radius: w * 0.2,
        color: 'rgba(168, 85, 247, 0.02)',
        opacity: 1,
        driftX: 0.04,
        driftY: -0.05,
      },
      {
        x: w * 0.85,
        y: h * 0.15,
        radius: w * 0.15,
        color: 'rgba(110, 218, 176, 0.02)',
        opacity: 1,
        driftX: -0.03,
        driftY: 0.06,
      },
    ]
    nebulaeRef.current = nebulae
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (starsRef.current.length === 0) {
        init(rect.width, rect.height)
      }
    }

    resize()
    window.addEventListener('resize', resize)

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const handleLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 }
    }

    canvas.addEventListener('mousemove', handleMouse)
    canvas.addEventListener('mouseleave', handleLeave)

    const tick = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      const stars = starsRef.current
      const shootingStars = shootingStarsRef.current
      const nebulae = nebulaeRef.current

      ctx.clearRect(0, 0, w, h)
      timeRef.current += 1
      const t = timeRef.current

      // Draw nebulae (soft galaxy clouds)
      for (const n of nebulae) {
        const nx = n.x + Math.sin(t * 0.003 * n.driftX) * 30
        const ny = n.y + Math.cos(t * 0.003 * n.driftY) * 20
        const pulse = 1 + Math.sin(t * 0.005) * 0.1
        const gradient = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.radius * pulse)
        gradient.addColorStop(0, n.color)
        gradient.addColorStop(0.5, n.color.replace(/[\d.]+\)$/, '0.01)'))
        gradient.addColorStop(1, 'transparent')
        ctx.globalAlpha = 1
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(nx, ny, n.radius * pulse, 0, Math.PI * 2)
        ctx.fill()
      }

      // Draw stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i]
        const twinkle = Math.sin(t * s.twinkleSpeed + s.twinkleOffset)
        const opacity = s.baseOpacity + twinkle * s.baseOpacity * 0.6

        // Mouse proximity brightness boost
        const dx = s.x - mx
        const dy = s.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        const mouseBoost = dist < MOUSE_RADIUS ? (1 - dist / MOUSE_RADIUS) * 0.5 : 0

        const finalOpacity = Math.min(opacity + mouseBoost, 1)

        // Draw glow for bright stars
        if (s.glowRadius > 0) {
          const glowSize = s.glowRadius * (1 + twinkle * 0.3)
          const gradient = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowSize)
          gradient.addColorStop(0, s.color)
          gradient.addColorStop(0.4, s.color.replace(')', ', 0.15)').replace('rgb', 'rgba'))
          gradient.addColorStop(1, 'transparent')
          ctx.globalAlpha = finalOpacity * 0.3
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(s.x, s.y, glowSize, 0, Math.PI * 2)
          ctx.fill()

          // Draw cross sparkle for brightest stars
          if (s.radius > 1.5 && finalOpacity > 0.5) {
            const sparkleLen = s.radius * 3 * (1 + twinkle * 0.4)
            ctx.globalAlpha = finalOpacity * 0.2
            ctx.strokeStyle = s.color
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(s.x - sparkleLen, s.y)
            ctx.lineTo(s.x + sparkleLen, s.y)
            ctx.moveTo(s.x, s.y - sparkleLen)
            ctx.lineTo(s.x, s.y + sparkleLen)
            ctx.stroke()
          }
        }

        // Draw star core
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
        ctx.fillStyle = s.color
        ctx.globalAlpha = finalOpacity
        ctx.fill()
      }

      // Shooting stars
      if (Math.random() < 0.003 && shootingStars.length < 2) {
        const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.2
        const speed = 3 + Math.random() * 4
        shootingStars.push({
          x: Math.random() * w * 0.8,
          y: Math.random() * h * 0.4,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          length: 40 + Math.random() * 60,
          life: 0,
          maxLife: 50 + Math.random() * 30,
          color: '#ffffff',
        })
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i]
        ss.x += ss.vx
        ss.y += ss.vy
        ss.life++

        const progress = ss.life / ss.maxLife
        const fadeIn = Math.min(progress * 4, 1)
        const fadeOut = 1 - Math.max((progress - 0.6) / 0.4, 0)
        const alpha = fadeIn * fadeOut * 0.7

        const tailX = ss.x - (ss.vx / Math.sqrt(ss.vx ** 2 + ss.vy ** 2)) * ss.length
        const tailY = ss.y - (ss.vy / Math.sqrt(ss.vx ** 2 + ss.vy ** 2)) * ss.length

        const gradient = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y)
        gradient.addColorStop(0, 'transparent')
        gradient.addColorStop(0.7, `rgba(255, 255, 255, ${alpha * 0.3})`)
        gradient.addColorStop(1, `rgba(255, 255, 255, ${alpha})`)

        ctx.globalAlpha = 1
        ctx.strokeStyle = gradient
        ctx.lineWidth = 1.5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(ss.x, ss.y)
        ctx.stroke()

        // Head glow
        ctx.globalAlpha = alpha * 0.5
        const headGlow = ctx.createRadialGradient(ss.x, ss.y, 0, ss.x, ss.y, 4)
        headGlow.addColorStop(0, '#ffffff')
        headGlow.addColorStop(1, 'transparent')
        ctx.fillStyle = headGlow
        ctx.beginPath()
        ctx.arc(ss.x, ss.y, 4, 0, Math.PI * 2)
        ctx.fill()

        if (ss.life >= ss.maxLife) {
          shootingStars.splice(i, 1)
        }
      }

      // Subtle mouse constellation glow
      if (mx > 0 && my > 0) {
        const gradient = ctx.createRadialGradient(mx, my, 0, mx, my, MOUSE_RADIUS * 0.6)
        gradient.addColorStop(0, 'rgba(140, 180, 255, 0.05)')
        gradient.addColorStop(0.5, 'rgba(110, 218, 176, 0.02)')
        gradient.addColorStop(1, 'transparent')
        ctx.globalAlpha = 1
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(mx, my, MOUSE_RADIUS * 0.6, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalAlpha = 1
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', handleMouse)
      canvas.removeEventListener('mouseleave', handleLeave)
    }
  }, [init])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-[1]"
      style={{ pointerEvents: 'auto' }}
      aria-hidden="true"
    />
  )
}

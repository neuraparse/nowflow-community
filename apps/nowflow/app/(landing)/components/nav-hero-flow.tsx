'use client'

import { useEffect, useState } from 'react'

export default function NavHeroFlow() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[5] hidden sm:block overflow-hidden"
      aria-hidden="true"
    >
      {/* Left side step edges */}
      <div
        className="absolute transition-all duration-[1.8s] ease-out"
        style={{
          top: 56,
          left: 0,
          width: visible ? 120 : 0,
          height: 2,
          background: 'linear-gradient(to right, transparent, #0f766e)',
          opacity: visible ? 0.4 : 0,
        }}
      />
      <div
        className="absolute transition-all duration-[1.4s] ease-out delay-200"
        style={{
          top: 56,
          left: 120,
          width: 2,
          height: visible ? 80 : 0,
          background: 'linear-gradient(to bottom, #0f766e, #0f766e)',
          opacity: visible ? 0.35 : 0,
        }}
      />
      <div
        className="absolute transition-all duration-[1.6s] ease-out delay-500"
        style={{
          top: 136,
          left: 0,
          width: visible ? 122 : 0,
          height: 2,
          background: 'linear-gradient(to right, transparent, #0f766e)',
          opacity: visible ? 0.25 : 0,
        }}
      />

      {/* Left side - second step (lower) */}
      <div
        className="absolute transition-all duration-[1.5s] ease-out delay-300"
        style={{
          top: 80,
          left: 0,
          width: visible ? 60 : 0,
          height: 2,
          background: 'linear-gradient(to right, transparent, #0f766e)',
          opacity: visible ? 0.2 : 0,
        }}
      />
      <div
        className="absolute transition-all duration-[1.2s] ease-out delay-700"
        style={{
          top: 80,
          left: 60,
          width: 2,
          height: visible ? 140 : 0,
          background: 'linear-gradient(to bottom, #0f766e, transparent)',
          opacity: visible ? 0.18 : 0,
        }}
      />

      {/* Left node dots */}
      <div
        className="absolute rounded-full transition-all duration-500 delay-200"
        style={{
          top: 53,
          left: 118,
          width: 8,
          height: 8,
          background: '#0f766e',
          opacity: visible ? 0.5 : 0,
          transform: visible ? 'scale(1)' : 'scale(0)',
        }}
      />
      <div
        className="absolute rounded-full transition-all duration-500 delay-700"
        style={{
          top: 133,
          left: 118,
          width: 6,
          height: 6,
          background: '#0f766e',
          opacity: visible ? 0.3 : 0,
          transform: visible ? 'scale(1)' : 'scale(0)',
        }}
      />

      {/* Right side step edges */}
      <div
        className="absolute transition-all duration-[1.8s] ease-out delay-100"
        style={{
          top: 56,
          right: 0,
          width: visible ? 140 : 0,
          height: 2,
          background: 'linear-gradient(to left, transparent, #0f766e)',
          opacity: visible ? 0.4 : 0,
        }}
      />
      <div
        className="absolute transition-all duration-[1.4s] ease-out delay-300"
        style={{
          top: 56,
          right: 140,
          width: 2,
          height: visible ? 100 : 0,
          background: 'linear-gradient(to bottom, #0f766e, #0f766e)',
          opacity: visible ? 0.35 : 0,
        }}
      />
      <div
        className="absolute transition-all duration-[1.6s] ease-out delay-600"
        style={{
          top: 156,
          right: 0,
          width: visible ? 142 : 0,
          height: 2,
          background: 'linear-gradient(to left, transparent, #0f766e)',
          opacity: visible ? 0.25 : 0,
        }}
      />

      {/* Right side - second step */}
      <div
        className="absolute transition-all duration-[1.5s] ease-out delay-200"
        style={{
          top: 90,
          right: 0,
          width: visible ? 70 : 0,
          height: 2,
          background: 'linear-gradient(to left, transparent, #0f766e)',
          opacity: visible ? 0.2 : 0,
        }}
      />
      <div
        className="absolute transition-all duration-[1.2s] ease-out delay-600"
        style={{
          top: 90,
          right: 70,
          width: 2,
          height: visible ? 160 : 0,
          background: 'linear-gradient(to bottom, #0f766e, transparent)',
          opacity: visible ? 0.18 : 0,
        }}
      />

      {/* Right node dots */}
      <div
        className="absolute rounded-full transition-all duration-500 delay-300"
        style={{
          top: 53,
          right: 138,
          width: 8,
          height: 8,
          background: '#0f766e',
          opacity: visible ? 0.5 : 0,
          transform: visible ? 'scale(1)' : 'scale(0)',
        }}
      />
      <div
        className="absolute rounded-full transition-all duration-500 delay-700"
        style={{
          top: 153,
          right: 138,
          width: 6,
          height: 6,
          background: '#0f766e',
          opacity: visible ? 0.3 : 0,
          transform: visible ? 'scale(1)' : 'scale(0)',
        }}
      />
    </div>
  )
}

import React from 'react'

type AgentProfile = {
  name: string
  avatar?: string | null
  type: string
}

type AgentProfileBadgeProps = {
  agentProfile: AgentProfile
}

export const AgentProfileBadge = React.memo(function AgentProfileBadge({
  agentProfile,
}: AgentProfileBadgeProps) {
  const pc =
    agentProfile.type === 'human_agent'
      ? { from: '#f59e0b', to: '#ea580c', glow: 'rgba(245,158,11,0.25)' }
      : agentProfile.type === 'hybrid'
        ? { from: '#3b82f6', to: '#6366f1', glow: 'rgba(59,130,246,0.25)' }
        : { from: '#8b5cf6', to: '#a855f7', glow: 'rgba(139,92,246,0.25)' }

  return (
    <div
      className="absolute z-20 flex items-center gap-[3px] pointer-events-none"
      style={{
        top: -6,
        right: 10,
        height: 14,
        paddingLeft: 3,
        paddingRight: 4,
        borderRadius: 7,
        background: `linear-gradient(135deg, ${pc.from}, ${pc.to})`,
        boxShadow: `0 1px 4px ${pc.glow}, inset 0 1px 0 rgba(255,255,255,0.12)`,
      }}
    >
      {/* Avatar */}
      <div
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)',
        }}
      >
        {agentProfile.avatar ? (
          <span className="text-[8px] leading-none">{agentProfile.avatar}</span>
        ) : agentProfile.type === 'human_agent' ? (
          <svg width="8" height="8" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="7" r="3.5" fill="white" fillOpacity="0.95" />
            <path
              d="M3 18c0-3.5 3-6 7-6s7 2.5 7 6"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              fill="white"
              fillOpacity="0.15"
            />
          </svg>
        ) : agentProfile.type === 'hybrid' ? (
          <svg width="8" height="8" viewBox="0 0 20 20" fill="none">
            <circle cx="8" cy="7" r="3" fill="white" fillOpacity="0.9" />
            <path
              d="M2 17c0-3 2.5-5 6-5s6 2 6 5"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="white"
              fillOpacity="0.1"
            />
            <path
              d="M15.5 3l-2 3.5h4L15.5 10"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="white"
              fillOpacity="0.4"
            />
          </svg>
        ) : (
          <svg width="8" height="8" viewBox="0 0 20 20" fill="none">
            <rect
              x="4"
              y="3"
              width="12"
              height="9"
              rx="3"
              stroke="white"
              strokeWidth="1.5"
              fill="white"
              fillOpacity="0.15"
            />
            <circle cx="7.5" cy="7.5" r="1.3" fill="white" fillOpacity="0.95" />
            <circle cx="12.5" cy="7.5" r="1.3" fill="white" fillOpacity="0.95" />
            <path d="M7 14h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <path
              d="M8.5 14v2.5M11.5 14v2.5"
              stroke="white"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
      {/* Name */}
      <span
        className="text-[6px] font-logo font-semibold leading-none truncate text-white"
        style={{ maxWidth: 72, textShadow: '0 1px 2px rgba(0,0,0,0.14)' }}
      >
        {agentProfile.name}
      </span>
    </div>
  )
})

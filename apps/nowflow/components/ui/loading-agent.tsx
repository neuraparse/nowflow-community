'use client'

export interface LoadingAgentProps {
  /**
   * Size of the loading agent
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingAgent({ size = 'md' }: LoadingAgentProps) {
  // Size mappings for width and height
  const sizes = {
    sm: { width: 16, height: 18 },
    md: { width: 21, height: 24 },
    lg: { width: 30, height: 34 },
  }

  const { width, height } = sizes[size]

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="animate-spin"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="60 40"
      />
    </svg>
  )
}

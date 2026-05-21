import React from 'react'

interface WebhookIconProps {
  className?: string
  variant?: 'default' | 'gradient' | 'outline'
}

/**
 * Modern Webhook Icon Component
 * A professional, scalable webhook icon with multiple variants
 */
export function WebhookIcon({ className = '', variant = 'default' }: WebhookIconProps) {
  if (variant === 'gradient') {
    return (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
          <linearGradient id="webhook-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
          fill="url(#webhook-gradient)"
          opacity="0.2"
        />
        <path
          d="M8.5 8.5L12 12m0 0l3.5-3.5M12 12v8m0-8L8.5 15.5M12 12l3.5 3.5"
          stroke="url(#webhook-gradient)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="4" r="1.5" fill="url(#webhook-gradient)" />
        <circle cx="7" cy="17" r="1.5" fill="url(#webhook-gradient)" />
        <circle cx="17" cy="17" r="1.5" fill="url(#webhook-gradient)" />
      </svg>
    )
  }

  if (variant === 'outline') {
    return (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path
          d="M12 4v8m0 0l-3.5-3.5M12 12l3.5-3.5M12 12v8m0-8L8.5 15.5M12 12l3.5 3.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="7" cy="17" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="17" cy="17" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    )
  }

  // Default variant
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M12 4v8m0 0l-3.5-3.5M12 12l3.5-3.5M12 12v8m0-8L8.5 15.5M12 12l3.5 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="4" r="1.5" fill="currentColor" />
      <circle cx="7" cy="17" r="1.5" fill="currentColor" />
      <circle cx="17" cy="17" r="1.5" fill="currentColor" />
    </svg>
  )
}

/**
 * Webhook Status Icon - Shows webhook health status
 */
export function WebhookStatusIcon({
  status,
  className = '',
}: {
  status: 'active' | 'inactive' | 'error' | 'warning'
  className?: string
}) {
  const colors = {
    active: '#10b981',
    inactive: '#6b7280',
    error: '#ef4444',
    warning: '#f59e0b',
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="12" cy="12" r="10" fill={colors[status]} opacity="0.1" />
      <circle cx="12" cy="12" r="6" fill={colors[status]} opacity="0.3" />
      <circle cx="12" cy="12" r="3" fill={colors[status]} />
      {status === 'active' && (
        <circle cx="12" cy="12" r="8" stroke={colors[status]} strokeWidth="2" opacity="0.5">
          <animate attributeName="r" from="8" to="10" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  )
}

/**
 * Webhook Activity Icon - Shows webhook activity/trigger
 */
export function WebhookActivityIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="currentColor" opacity="0.2" />
      <path
        d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Webhook Security Icon - Shows security features
 */
export function WebhookSecurityIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M12 2L4 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-8-4z"
        fill="currentColor"
        opacity="0.1"
      />
      <path
        d="M12 2L4 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-8-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Webhook Retry Icon - Shows retry mechanism
 */
export function WebhookRetryIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M4 12a8 8 0 0 1 14.93-4M20 12a8 8 0 0 1-14.93 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 8l1-4 4 1M6 16l-1 4-4-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

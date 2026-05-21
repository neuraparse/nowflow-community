'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface NavSectionProps {
  children: ReactNode
  isLoading?: boolean
  itemCount?: number
  isCollapsed?: boolean
}

interface NavItemProps {
  icon: ReactNode
  label: string
  href?: string
  active?: boolean
  onClick?: () => void
  isCollapsed?: boolean
}

export function NavSection({
  children,
  isLoading = false,
  itemCount = 3,
  isCollapsed,
}: NavSectionProps) {
  if (isLoading) {
    return (
      <nav className="space-y-0.5">
        {Array(itemCount)
          .fill(0)
          .map((_, i) => (
            <NavItemSkeleton key={i} isCollapsed={isCollapsed} />
          ))}
      </nav>
    )
  }

  return <nav className="space-y-1">{children}</nav>
}

function NavItem({ icon, label, href, active, onClick, isCollapsed }: NavItemProps) {
  const pathname = usePathname()
  const isActive = active || (href ? pathname === href || pathname.startsWith(`${href}/`) : false)

  const baseClass = [
    'workflow-editor-nav-item flex items-center gap-2.5 rounded-[4px] border text-[12px] font-logo font-medium transition-all duration-200',
    isCollapsed ? 'w-8 h-8 mx-auto justify-center px-0 py-0' : 'px-2.5 py-[7px] w-full',
    isActive
      ? 'is-active border-white/[0.08] text-[#dce7e2] bg-white/[0.05]'
      : 'border-transparent text-black/60 dark:text-white/70 hover:border-white/[0.05] hover:text-black/90 dark:hover:text-white/95 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]',
    onClick ? 'cursor-pointer' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      <div
        className={`workflow-editor-nav-icon flex items-center justify-center w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'is-active text-[#4A7A68] dark:text-[#94B8A6]' : ''}`}
      >
        {icon}
      </div>
      {!isCollapsed && <span className="truncate">{label}</span>}
    </>
  )

  if (isCollapsed) {
    const wrapper = href ? (
      <Link href={href} className={baseClass}>
        {content}
      </Link>
    ) : (
      <button onClick={onClick} className={baseClass}>
        {content}
      </button>
    )
    return (
      <Tooltip>
        <TooltipTrigger asChild>{wrapper}</TooltipTrigger>
        <TooltipContent
          side="right"
          className="bg-[#1b1b1b] text-white text-[11px] font-logo border-none"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {content}
      </Link>
    )
  }

  return (
    <button onClick={onClick} className={baseClass}>
      {content}
    </button>
  )
}

function NavItemSkeleton({ isCollapsed }: { isCollapsed?: boolean }) {
  if (isCollapsed) {
    return (
      <div className="w-8 h-8 mx-auto flex items-center justify-center">
        <div className="h-[18px] w-[18px] rounded-[4px] bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 px-2.5 py-[7px]">
      <div className="h-[18px] w-[18px] rounded-[4px] bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
      <div className="h-3.5 w-20 rounded-[4px] bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
    </div>
  )
}

NavSection.Item = NavItem
NavSection.Skeleton = NavItemSkeleton

import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const paragraphClass = 'text-[14px] text-zinc-400 dark:text-white/40 font-sans leading-[1.8] mb-4'

const bulletClass =
  "text-[14px] text-zinc-400 dark:text-white/40 font-sans leading-[1.8] relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[10px] before:w-1 before:h-1 before:rounded-full before:bg-[#4A7A68]/30 dark:before:bg-[#8CB09C]/20"

const linkClass =
  'text-[#4A7A68] dark:text-[#8CB09C] underline underline-offset-4 decoration-[#4A7A68]/20 dark:decoration-[#8CB09C]/20 hover:decoration-[#4A7A68]/50'

export const LegalParagraph = ({ className, children, ...rest }: ComponentPropsWithoutRef<'p'>) => (
  <p className={cn(paragraphClass, className)} {...rest}>
    {children}
  </p>
)

export const LegalSectionHeading = ({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<'h2'>) => (
  <h2
    className={cn(
      'text-lg font-sans font-semibold text-zinc-800 dark:text-white tracking-tight mb-4',
      className
    )}
    {...rest}
  >
    {children}
  </h2>
)

export const LegalSubheading = ({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<'h3'>) => (
  <h3
    className={cn(
      'text-[14px] font-semibold text-[#4A7A68] dark:text-[#8CB09C] font-sans mb-3',
      className
    )}
    {...rest}
  >
    {children}
  </h3>
)

export const LegalDivider = ({ className }: { className?: string }) => (
  <div className={cn('h-px bg-black/[0.06] dark:bg-white/[0.06]', className)} />
)

export const LegalBulletList = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => <ul className={cn('space-y-2 mb-6 pl-5', className)}>{children}</ul>

export const LegalBulletItem = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => <li className={cn(bulletClass, className)}>{children}</li>

export const LegalStrong = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => <strong className={cn('text-zinc-700 dark:text-white/50', className)}>{children}</strong>

type LegalLinkProps = ComponentPropsWithoutRef<typeof Link>

export const LegalLink = ({ className, children, ...rest }: LegalLinkProps) => (
  <Link className={cn(linkClass, className)} {...rest}>
    {children}
  </Link>
)

export const LegalInfoBox = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <div
    className={cn(
      'rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] p-6',
      className
    )}
  >
    {children}
  </div>
)

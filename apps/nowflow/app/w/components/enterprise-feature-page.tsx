'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { ENTERPRISE_REQUEST_LABEL, ENTERPRISE_URL } from '@/lib/community/enterprise'
import { useSidebarStore } from '@/stores/sidebar/store'
import { WorkspaceEmptyState, WorkspacePageHeader } from './workspace-shell'

type EnterpriseFeaturePageProps = {
  eyebrow: string
  title: string
  accent?: string
  description: string
}

export function EnterpriseFeaturePage({
  eyebrow,
  title,
  accent,
  description,
}: EnterpriseFeaturePageProps) {
  const { isExpanded, mode } = useSidebarStore()
  const isCollapsed = mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'

  return (
    <div
      className={`workspace-stage min-h-screen py-6 px-6 transition-all duration-200 ${isCollapsed ? 'pl-20' : 'pl-72'}`}
    >
      <div className="max-w-5xl mx-auto">
        <WorkspacePageHeader
          eyebrow={eyebrow}
          title={title}
          accent={accent}
          description={description}
          className="mb-8"
        />
        <WorkspaceEmptyState
          icon={Lock}
          title="Enterprise feature"
          description="This capability is available in the Enterprise edition."
          action={
            <Link
              href={ENTERPRISE_URL}
              target="_blank"
              rel="noreferrer"
              className="h-9 px-4 rounded-lg bg-[#4A7A68] hover:bg-[#3d6556] text-white text-[12px] font-logo font-medium inline-flex items-center justify-center"
            >
              {ENTERPRISE_REQUEST_LABEL}
            </Link>
          }
        />
      </div>
    </div>
  )
}

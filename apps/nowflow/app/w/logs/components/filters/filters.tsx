'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ModernFilterIcon } from '@/components/modern-logs-icons'
import FilterSection from './components/filter-section'
import Level from './components/level'
import Timeline from './components/timeline'
import Workflow from './components/workflow'

/**
 * Filters component for logs page - includes timeline and other filter options
 */
export function Filters() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div
      className={`relative transition-all duration-300 ease-in-out w-full border-b border-black/[0.06] dark:border-white/[0.06] bg-white/30 dark:bg-slate-900/30 backdrop-blur-[2px] shadow-sm ${
        isCollapsed ? 'h-10' : 'h-auto'
      }`}
    >
      {/* Toggle button */}
      <button
        className={`absolute top-2 right-3 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.06] shadow-sm hover:shadow-md transition-all duration-200 ${
          isCollapsed ? '' : 'rotate-180'
        }`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <ChevronLeft className="h-3 w-3 text-zinc-400 dark:text-white/40 rotate-90" />
      </button>

      <div
        className={`p-3 transition-all duration-300 ${
          isCollapsed ? 'opacity-0 invisible h-0' : 'opacity-100 visible h-auto'
        }`}
      >
        <div className="flex items-center gap-2 mb-3 pl-1">
          <ModernFilterIcon className="h-4 w-4 text-zinc-500 dark:text-white/50" />
          <h2 className="text-sm font-medium text-zinc-600 dark:text-white/60 font-logo">
            Filters
          </h2>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="w-full xs:w-[calc(33.33%-1rem)] mb-2">
            {/* Timeline Filter */}
            <FilterSection title="Timeline" defaultOpen={true} content={<Timeline />} />
          </div>

          <div className="w-full xs:w-[calc(33.33%-1rem)] mb-2">
            {/* Level Filter */}
            <FilterSection title="Level" defaultOpen={true} content={<Level />} />
          </div>

          <div className="w-full xs:w-[calc(33.33%-1rem)] mb-2">
            {/* Workflow Filter */}
            <FilterSection title="Workflow" defaultOpen={true} content={<Workflow />} />
          </div>
        </div>
      </div>

      {isCollapsed && (
        <div className="flex items-center h-10 px-3">
          <ModernFilterIcon className="h-4 w-4 text-zinc-500 dark:text-white/50 mr-2" />
          <span className="text-sm font-medium text-zinc-600 dark:text-white/60 font-logo">
            Filters
          </span>
        </div>
      )}
    </div>
  )
}

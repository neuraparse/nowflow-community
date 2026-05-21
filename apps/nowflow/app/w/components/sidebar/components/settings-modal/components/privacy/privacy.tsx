'use client'

import { useEffect, useState } from 'react'
import { Database, HardDrive, Lock, Shield, Trash2 } from 'lucide-react'
import { ModernPrivacyIcon } from '@/components/modern-privacy-icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { createLogger } from '@/lib/logs/console-logger'
import { ResearchConsentCard } from './research-consent-card'

const logger = createLogger('Privacy')

export function Privacy() {
  const [localStorageSize, setLocalStorageSize] = useState<string>('Calculating...')
  const [clearCacheDialogOpen, setClearCacheDialogOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  useEffect(() => {
    try {
      let totalSize = 0
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          const value = localStorage.getItem(key) || ''
          totalSize += key.length + value.length
        }
      }
      const sizeKB = (totalSize * 2) / 1024 // UTF-16 = 2 bytes per char
      if (sizeKB > 1024) {
        setLocalStorageSize(`${(sizeKB / 1024).toFixed(1)} MB`)
      } else {
        setLocalStorageSize(`${sizeKB.toFixed(0)} KB`)
      }
    } catch {
      setLocalStorageSize('Unknown')
    }
  }, [])

  const handleClearCache = async () => {
    try {
      setIsClearing(true)
      // Keep auth-related keys
      const keysToKeep: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('better-auth') || key === 'theme')) {
          keysToKeep.push(key)
        }
      }

      const preservedData: Record<string, string> = {}
      keysToKeep.forEach((key) => {
        const value = localStorage.getItem(key)
        if (value) preservedData[key] = value
      })

      localStorage.clear()

      // Restore preserved keys
      Object.entries(preservedData).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })

      setLocalStorageSize('0 KB')
      logger.info('Local cache cleared')
    } catch (error) {
      logger.error('Error clearing cache:', { error })
    } finally {
      setIsClearing(false)
      setClearCacheDialogOpen(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-[15px] font-logo font-semibold mb-1 text-zinc-800 dark:text-white flex items-center gap-2">
          <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
            <ModernPrivacyIcon className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" />
          </span>
          Privacy & Data
        </h3>
        <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40 mb-6 ml-9">
          Manage your data privacy settings and local storage.
        </p>
      </div>

      {/* Data Collection Status */}
      <div className="p-4 bg-green-50/80 dark:bg-green-950/20 border border-green-200/60 dark:border-green-800/40 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="font-medium text-green-800 dark:text-green-300 text-sm">
            Privacy Protected
          </span>
        </div>
        <p className="text-xs text-green-700 dark:text-green-400">
          Telemetry and analytics collection are off by default. Your workflows and data stay
          private unless you explicitly opt into anonymized research below.
        </p>
      </div>

      {/* Data Storage Info */}
      <div className="space-y-3">
        <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
          Data Storage
        </h4>

        <div className="space-y-2">
          <div className="silver-glass-pane flex items-center gap-3 rounded-lg bg-transparent py-3 px-4">
            <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-2 rounded-lg">
              <Database className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
            </span>
            <div className="flex-1">
              <p className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
                Cloud Database
              </p>
              <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
                Workflows, settings, and account data are stored securely in our encrypted database.
              </p>
            </div>
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Lock className="h-3 w-3" strokeWidth={1.5} />
              Encrypted
            </span>
          </div>

          <div className="silver-glass-pane flex items-center gap-3 rounded-lg bg-transparent py-3 px-4">
            <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-2 rounded-lg">
              <HardDrive className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
            </span>
            <div className="flex-1">
              <p className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
                Local Storage
              </p>
              <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
                Preferences and cached data stored in your browser.
              </p>
            </div>
            <span className="text-[11px] font-logo text-zinc-400 dark:text-white/40 font-mono">
              {localStorageSize}
            </span>
          </div>
        </div>
      </div>

      {/* Research Participation (opt-in) */}
      <ResearchConsentCard />

      {/* Local Data Management */}
      <div className="space-y-3">
        <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
          Local Data Management
        </h4>

        <button
          onClick={() => setClearCacheDialogOpen(true)}
          className="silver-glass-pane w-full flex items-center gap-3 rounded-lg bg-transparent py-3 px-4 transition-all duration-200 text-left"
        >
          <span className="bg-amber-500/10 p-2 rounded-full">
            <Trash2 className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
          </span>
          <div>
            <p className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
              Clear Local Cache
            </p>
            <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
              Remove cached data from your browser. Auth session and theme will be preserved.
            </p>
          </div>
        </button>
      </div>

      {/* Data Retention */}
      <div className="space-y-3">
        <h4 className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
          Data Retention
        </h4>
        <div className="silver-glass-pane rounded-lg bg-transparent p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
            <span className="font-logo text-[12px] font-medium text-zinc-800 dark:text-white">
              How your data is handled
            </span>
          </div>
          <ul className="text-[11px] font-logo text-zinc-400 dark:text-white/40 space-y-1.5 ml-6 list-disc">
            <li>Workflow data is stored as long as your account is active</li>
            <li>Execution logs are retained for 30 days</li>
            <li>API keys and credentials are encrypted at rest</li>
            <li>You can export or delete all your data at any time from the Account tab</li>
          </ul>
        </div>
      </div>

      {/* Clear Cache Confirmation Dialog */}
      <AlertDialog open={clearCacheDialogOpen} onOpenChange={setClearCacheDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Local Cache</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all cached data from your browser&apos;s local storage. Your login
              session and theme preference will be preserved. You may need to reload the page after
              clearing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCache} disabled={isClearing}>
              {isClearing ? 'Clearing...' : 'Clear Cache'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

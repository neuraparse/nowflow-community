import React from 'react'
import { Badge } from '@/components/ui/badge'

export const SemanticVersionBadge = React.memo(function SemanticVersionBadge({
  version,
}: {
  version: string
}) {
  const parts = version.split('.')
  if (parts.length !== 3) {
    return (
      <Badge variant="outline" className="font-mono text-xs bg-black/[0.04] dark:bg-white/[0.06]">
        {version}
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="font-mono text-xs bg-black/[0.04] dark:bg-white/[0.06] gap-0 px-1.5"
    >
      <span className="text-orange-600 dark:text-orange-400">{parts[0]}</span>
      <span className="text-muted-foreground">.</span>
      <span className="text-blue-600 dark:text-blue-400">{parts[1]}</span>
      <span className="text-muted-foreground">.</span>
      <span className="text-green-600 dark:text-green-400">{parts[2]}</span>
    </Badge>
  )
})

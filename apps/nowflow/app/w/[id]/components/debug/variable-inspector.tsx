'use client'

import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, Copy, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

interface VariableInspectorProps {
  variables: Record<string, any>
  blockStates?: Record<string, any>
}

function VariableNode({ name, value, depth = 0 }: { name: string; value: any; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const [copied, setCopied] = useState(false)

  const isObject = value !== null && typeof value === 'object'
  const isArray = Array.isArray(value)

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(value, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getValuePreview = () => {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (typeof value === 'string') return `"${value.slice(0, 50)}${value.length > 50 ? '...' : ''}"`
    if (typeof value === 'number') return value.toString()
    if (typeof value === 'boolean') return value.toString()
    if (isArray) return `Array(${value.length})`
    if (isObject) return `Object(${Object.keys(value).length})`
    return String(value)
  }

  const getTypeColor = () => {
    if (value === null || value === undefined) return 'text-zinc-400 dark:text-white/40'
    if (typeof value === 'string') return 'text-green-600 dark:text-green-400'
    if (typeof value === 'number') return 'text-blue-600 dark:text-blue-400'
    if (typeof value === 'boolean') return 'text-purple-600 dark:text-purple-400'
    return 'text-zinc-600 dark:text-white/60'
  }

  return (
    <div className="font-mono text-sm">
      <div
        className="flex items-center gap-1 py-0.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded px-1 group cursor-pointer"
        style={{ paddingLeft: `${depth * 16}px` }}
        onClick={() => isObject && setExpanded(!expanded)}
      >
        {isObject ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-zinc-400 dark:text-white/40" />
          ) : (
            <ChevronRight className="h-3 w-3 text-zinc-400 dark:text-white/40" />
          )
        ) : (
          <span className="w-3" />
        )}
        <span className="text-zinc-800 dark:text-white/80">{name}:</span>
        <span className={getTypeColor()}>{getValuePreview()}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 ml-auto"
          onClick={(e) => {
            e.stopPropagation()
            handleCopy()
          }}
        >
          {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      {isObject && expanded && (
        <div>
          {Object.entries(value).map(([key, val]) => (
            <VariableNode
              key={key}
              name={isArray ? `[${key}]` : key}
              value={val}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function VariableInspector({ variables, blockStates }: VariableInspectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'variables' | 'blocks'>('variables')

  const filterVariables = (vars: Record<string, any>) => {
    if (!searchQuery) return vars
    const filtered: Record<string, any> = {}
    for (const [key, value] of Object.entries(vars)) {
      if (key.toLowerCase().includes(searchQuery.toLowerCase())) {
        filtered[key] = value
      } else if (
        typeof value === 'string' &&
        value.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        filtered[key] = value
      }
    }
    return filtered
  }

  return (
    <Card className="border-black/[0.06] dark:border-white/[0.06]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium font-logo text-zinc-800 dark:text-white flex items-center justify-between">
          Variable Inspector
          <div className="flex gap-1">
            <Badge
              className={`cursor-pointer ${activeTab === 'variables' ? 'bg-blue-600' : 'bg-zinc-600 dark:bg-white/20'}`}
              onClick={() => setActiveTab('variables')}
            >
              Variables
            </Badge>
            <Badge
              className={`cursor-pointer ${activeTab === 'blocks' ? 'bg-blue-600' : 'bg-zinc-600 dark:bg-white/20'}`}
              onClick={() => setActiveTab('blocks')}
            >
              Block States
            </Badge>
          </div>
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-white/40" />
          <Input
            placeholder="Search variables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          {activeTab === 'variables' ? (
            Object.keys(filterVariables(variables)).length > 0 ? (
              Object.entries(filterVariables(variables)).map(([key, value]) => (
                <VariableNode key={key} name={key} value={value} />
              ))
            ) : (
              <p className="text-sm text-zinc-400 dark:text-white/40 text-center py-4">
                {searchQuery ? 'No matching variables' : 'No variables'}
              </p>
            )
          ) : blockStates && Object.keys(blockStates).length > 0 ? (
            Object.entries(blockStates).map(([blockId, state]) => (
              <div key={blockId} className="mb-2">
                <div className="text-xs font-medium text-zinc-400 dark:text-white/40 mb-1">
                  {blockId}
                </div>
                <VariableNode name="state" value={state} />
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-400 dark:text-white/40 text-center py-4">
              No block states
            </p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

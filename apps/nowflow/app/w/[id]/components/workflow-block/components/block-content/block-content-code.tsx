'use client'

import { useState } from 'react'
import { Check, Code as CodeIcon, Copy, Play, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createLogger } from '@/lib/logs/console-logger'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { BlockContentSection } from './block-content-section'

const logger = createLogger('block-content-code')

interface BlockContentCodeProps {
  blockId: string
}

export function BlockContentCode({ blockId }: BlockContentCodeProps) {
  const blockType = useWorkflowStore((state) => state.blocks[blockId]?.type || '')
  const [language, setLanguage] = useState('javascript')
  const [copied, setCopied] = useState(false)

  // Example code for different block types
  const getExampleCode = () => {
    switch (blockType) {
      case 'function':
        return `// Custom function block
function processData(input) {
  // Your custom logic here
  const result = input.data.map(item => {
    return {
      ...item,
      processed: true,
      timestamp: new Date().toISOString()
    };
  });

  return {
    success: true,
    data: result
  };
}`
      case 'condition':
        return `// Condition evaluation
function evaluateCondition(input) {
  // Check if the condition is met
  if (input.value > 100) {
    return true; // Route to "true" output
  } else {
    return false; // Route to "false" output
  }
}`
      case 'api':
        return `// API request handler
async function handleRequest(input) {
  try {
    const response = await fetch('https://api.example.com/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input)
    });

    const data = await response.json();
    return {
      success: true,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}`
      default:
        return `// Custom code for ${blockType} block
function process(input) {
  // Add your custom logic here
  logger.debug('Processing input:', input);

  // Return the processed result
  return {
    success: true,
    data: input
  };
}`
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(getExampleCode())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <BlockContentSection
        title="Custom Code"
        icon={<CodeIcon className="h-4 w-4" />}
        defaultOpen={true}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="javascript">JavaScript</SelectItem>
                <SelectItem value="typescript">TypeScript</SelectItem>
                <SelectItem value="python">Python</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            <pre className="bg-muted/30 p-4 rounded-md border border-border/40 text-xs font-mono overflow-x-auto whitespace-pre">
              {getExampleCode()}
            </pre>

            <div className="absolute top-2 right-2 flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md bg-background/80 backdrop-blur-sm hover:bg-background"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
            <Button variant="default" size="sm" className="text-xs h-8">
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Test Run
            </Button>
          </div>
        </div>
      </BlockContentSection>

      <BlockContentSection
        title="Code Settings"
        icon={<CodeIcon className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Execution Environment</Label>
              <p className="text-xs text-muted-foreground">Where the code will run</p>
            </div>
            <Select defaultValue="node">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="node">Node.js</SelectItem>
                <SelectItem value="browser">Browser</SelectItem>
                <SelectItem value="python">Python</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Timeout</Label>
              <p className="text-xs text-muted-foreground">Maximum execution time</p>
            </div>
            <Select defaultValue="5000">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select timeout" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1000">1 second</SelectItem>
                <SelectItem value="5000">5 seconds</SelectItem>
                <SelectItem value="10000">10 seconds</SelectItem>
                <SelectItem value="30000">30 seconds</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </BlockContentSection>
    </div>
  )
}

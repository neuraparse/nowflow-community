'use client'

import { ExternalLink, FileText, GitBranch, HelpCircle, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getBlock } from '@/blocks/index'
import { BlockContentSection } from './block-content-section'

interface BlockContentInfoProps {
  blockId: string
}

export function BlockContentInfo({ blockId }: BlockContentInfoProps) {
  const blockType = useWorkflowStore((state) => state.blocks[blockId]?.type || '')
  const blockConfig = getBlock(blockType)

  if (!blockConfig) {
    return <div>Block configuration not found</div>
  }

  return (
    <div className="space-y-4">
      <BlockContentSection
        title="Block Information"
        icon={<FileText className="h-4 w-4" />}
        defaultOpen={true}
      >
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Block Type</h4>
            <p className="text-sm">{blockConfig.name}</p>
          </div>

          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Description</h4>
            <p className="text-sm" title={blockConfig.description || 'No description available'}>
              {blockConfig.description
                ? blockConfig.description.length > 150
                  ? `${blockConfig.description.substring(0, 150)}...`
                  : blockConfig.description
                : 'No description available'}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Version</h4>
            <p className="text-sm">{blockConfig.version || '1.0.0'}</p>
          </div>
        </div>
      </BlockContentSection>

      <BlockContentSection
        title="Documentation"
        icon={<HelpCircle className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Learn more about how to use this block effectively.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => window.open('https://docs.example.com/blocks/' + blockType, '_blank')}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Documentation
              <ExternalLink className="h-3 w-3 ml-1.5 text-muted-foreground" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() =>
                window.open('https://community.example.com/blocks/' + blockType, '_blank')
              }
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Community
              <ExternalLink className="h-3 w-3 ml-1.5 text-muted-foreground" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() =>
                window.open('https://github.com/example/blocks/' + blockType, '_blank')
              }
            >
              <GitBranch className="h-3.5 w-3.5 mr-1.5" />
              Source Code
              <ExternalLink className="h-3 w-3 ml-1.5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </BlockContentSection>

      <BlockContentSection
        title="Usage Examples"
        icon={<MessageSquare className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Common usage patterns and examples for this block.
          </p>

          <div className="bg-muted/30 p-3 rounded-md border border-border/40">
            <h4 className="text-xs font-medium mb-1">Examples</h4>
            <div className="space-y-2">
              {blockConfig.examples && Array.isArray(blockConfig.examples) ? (
                blockConfig.examples.map((example, index) => (
                  <div key={index} className="text-xs text-muted-foreground">
                    <p className="font-medium">{example.title}</p>
                    <p>{example.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No examples available.</p>
              )}
            </div>
          </div>
        </div>
      </BlockContentSection>
    </div>
  )
}

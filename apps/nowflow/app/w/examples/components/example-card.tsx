import React from 'react'
import { Copy, ExternalLink, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ExampleCardProps {
  id: string
  title: string
  description: string
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  previewUrl?: string
  onUse?: (id: string) => void
  onCopy?: (id: string) => void
  onPreview?: (id: string) => void
}

export const ExampleCard = ({
  id,
  title,
  description,
  category,
  difficulty,
  tags,
  previewUrl,
  onUse,
  onCopy,
  onPreview,
}: ExampleCardProps) => {
  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'advanced':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-zinc-800 border-gray-200'
    }
  }

  return (
    <Card className="h-full hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold line-clamp-2">{title}</CardTitle>
            <Badge variant="outline" className="text-xs">
              {category}
            </Badge>
          </div>
          <Badge className={`text-xs ${getDifficultyColor(difficulty)}`}>{difficulty}</Badge>
        </div>
        <CardDescription className="text-sm text-muted-foreground line-clamp-3">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{tags.length - 3}
              </Badge>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onUse?.(id)} className="flex-1">
              <Play className="h-3 w-3 mr-1" />
              Use Template
            </Button>
            <Button size="sm" variant="outline" onClick={() => onCopy?.(id)}>
              <Copy className="h-3 w-3" />
            </Button>
            {previewUrl && (
              <Button size="sm" variant="outline" onClick={() => onPreview?.(id)}>
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ExampleCard

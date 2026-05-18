'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { MediaPreview } from './MediaPreview'
import { CommentsThread, type Comment } from './CommentsThread'
import { ActionButtons } from './ActionButtons'

export interface BrainAction {
  id: string
  action_type: string
  target: string | null
  assigned_producer: string | null
  payload: Record<string, unknown> | null
  executor_response: Record<string, unknown> | null
  generation_reason: string | null
  status: string
  executed_at: string | null
  priority_score: number | null
  predicted_north_star_impact: number | null
  comments: Comment[]
  cost_estimate_usd: number | null
  assigned_approver: string | null
}

interface ActionCardProps {
  action: BrainAction
}

const STATUS_CLASSES: Record<string, string> = {
  ready: 'bg-success/10 text-success border-success/20',
  needs_changes: 'bg-destructive/10 text-destructive border-destructive/20',
  approved: 'bg-primary/10 text-primary border-primary/20',
  killed: 'bg-muted text-muted-foreground',
}

function extractProducerName(assigned_producer: string | null): string {
  if (!assigned_producer) return 'Unknown producer'
  const parts = assigned_producer.split('/')
  return parts[parts.length - 2] ?? parts[parts.length - 1] ?? assigned_producer
}

function extractCaptions(payload: Record<string, unknown> | null): Record<string, string> {
  if (!payload) return {}
  const captions = payload['captions'] ?? payload['caption_map']
  if (captions && typeof captions === 'object' && !Array.isArray(captions)) {
    return captions as Record<string, string>
  }
  if (typeof payload['caption'] === 'string') {
    return { default: payload['caption'] }
  }
  return {}
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="ghost" size="sm" onClick={copy} className="h-6 px-2 text-xs">
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

export function ActionCard({ action }: ActionCardProps) {
  const [status, setStatus] = useState(action.status)
  const producerName = extractProducerName(action.assigned_producer)
  const captions = extractCaptions(action.payload)
  const captionPlatforms = Object.keys(captions)

  return (
    <Card className={cn('overflow-hidden', status === 'killed' && 'opacity-60')}>
      {/* Top bar */}
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{producerName}</span>
              <Badge variant="outline" className="text-xs">
                {action.action_type}
              </Badge>
              <Badge
                variant="outline"
                className={cn('text-xs', STATUS_CLASSES[status] ?? STATUS_CLASSES['ready'])}
              >
                {status}
              </Badge>
            </div>
            {action.target && (
              <p className="text-sm text-muted-foreground">
                Target: <span className="font-medium text-foreground">{action.target}</span>
              </p>
            )}
            {action.generation_reason && (
              <p className="text-sm text-muted-foreground">{action.generation_reason}</p>
            )}
          </div>

          {/* Impact + cost */}
          <div className="shrink-0 space-y-1 text-right">
            {action.priority_score != null && (
              <div className="text-xs text-muted-foreground">
                Priority:{' '}
                <span className="font-medium text-foreground">{action.priority_score}</span>
              </div>
            )}
            {action.predicted_north_star_impact != null && (
              <div className="text-xs text-muted-foreground">
                Est. impact:{' '}
                <span className="font-medium text-foreground">
                  {action.predicted_north_star_impact} seller leads
                </span>
              </div>
            )}
            {action.cost_estimate_usd != null && (
              <div className="text-xs text-muted-foreground">
                Cost est.:{' '}
                <span className="font-medium text-foreground">
                  ${action.cost_estimate_usd.toFixed(2)}
                </span>
              </div>
            )}
            {action.executed_at && (
              <div className="text-xs text-muted-foreground">
                {new Date(action.executed_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-0">
        {/* Media preview */}
        <MediaPreview
          actionType={action.action_type}
          executorResponse={action.executor_response}
        />

        {/* Per-platform captions */}
        {captionPlatforms.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Captions
            </p>
            {captionPlatforms.map((platform) => (
              <Collapsible key={platform}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between text-xs font-medium"
                  >
                    {platform}
                    <span className="text-muted-foreground">Toggle</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-1 rounded-lg border border-border bg-muted p-3">
                    <div className="mb-2 flex justify-end">
                      <CopyButton text={captions[platform]} />
                    </div>
                    <pre className="whitespace-pre-wrap text-xs text-foreground">
                      {captions[platform]}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}

        <Separator />

        {/* Action buttons */}
        <ActionButtons
          actionId={action.id}
          producerSlug={action.assigned_producer ?? ''}
          onStatusChange={setStatus}
        />

        <Separator />

        {/* Comments thread */}
        <CommentsThread
          actionId={action.id}
          comments={action.comments ?? []}
        />
      </CardContent>
    </Card>
  )
}

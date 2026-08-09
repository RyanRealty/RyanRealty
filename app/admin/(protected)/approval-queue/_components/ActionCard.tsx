'use client'

/**
 * ActionCard — one marketing_brain_actions row awaiting Matt's approval.
 *
 * 11F: off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — the BrainAction shape,
 * extractProducerName, extractCaptions, the local status state handed to
 * ActionButtons, and every visible string are carried over verbatim. This is the
 * human gate in front of publishing (CLAUDE.md §1); nothing here changes what
 * approving does. ci:bulk-approval-wired still reads <BulkSelectCheckbox>.
 *
 * Mapping: Card/CardHeader/CardContent -> av2-pane; Separator -> a 1px
 * var(--a-border) rule; Button -> the v2 Button (quiet), which carries the hover
 * the shadcn outline/ghost variants had; Collapsible -> a hand-built disclosure
 * that keeps Radix's aria-expanded + aria-controls wiring, because the v2 barrel
 * has no Collapsible primitive.
 *
 * Badge -> two different things on purpose. `status` is a status WORD, so it
 * takes StateWord. `action_type` is DATA ("content:listing_reel"), and
 * .av2-state applies text-transform:uppercase — so it takes .av2-chip instead,
 * the same call ProspectDocPill records.
 */

import { useId, useState } from 'react'
import { Button, StateWord, type AdminState } from '@/components/admin/v2'
import { cn } from '@/lib/utils'
import { MediaPreview } from './MediaPreview'
import { CommentsThread, type Comment } from './CommentsThread'
import { ActionButtons } from './ActionButtons'
import { BulkSelectCheckbox } from './BulkSelection'

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

/** ready = healthy, needs_changes = a problem, approved = acted on, killed = parked. */
const STATUS_STATE: Record<string, AdminState> = {
  ready: 'ok',
  needs_changes: 'down',
  approved: 'accent',
  killed: 'waiting',
}

const META_STYLE = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' } as const
const META_VALUE_STYLE = { fontWeight: 500, color: 'var(--a-text)' } as const

function Rule() {
  return <div aria-hidden style={{ height: 1, flexShrink: 0, background: 'var(--a-border)' }} />
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
    <Button
      variant="quiet"
      onClick={copy}
      style={{ minHeight: 0, height: 24, padding: '0 8px', fontSize: 'var(--a-text-xs)' }}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

/**
 * One platform's caption behind a disclosure. Radix's Collapsible supplied
 * aria-expanded + aria-controls off the trigger; both are reproduced here so the
 * control still announces its state. The hover comes from .av2-btn--quiet — no
 * inline background, which would beat the stylesheet and kill it.
 *
 * justify-content is set INLINE rather than with `justify-between`: admin-v2.css
 * is un-layered, so `.av2-btn { justify-content:center }` outranks the entire
 * Tailwind utilities layer and the class would have done nothing. `w-full` is
 * safe as a class — .av2-btn declares no width.
 */
function CaptionDisclosure({ platform, text }: { platform: string; text: string }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <div>
      <Button
        variant="quiet"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full"
        style={{ justifyContent: 'space-between', fontSize: 'var(--a-text-xs)', fontWeight: 500 }}
      >
        {platform}
        <span style={{ color: 'var(--a-text-2)' }}>Toggle</span>
      </Button>
      {open && (
        <div
          id={panelId}
          className="mt-1 p-3"
          style={{
            border: '1px solid var(--a-border)',
            borderRadius: 'var(--a-r-lg)',
            background: 'var(--a-inset)',
          }}
        >
          <div className="mb-2 flex justify-end">
            <CopyButton text={text} />
          </div>
          <pre
            className="whitespace-pre-wrap"
            style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text)' }}
          >
            {text}
          </pre>
        </div>
      )}
    </div>
  )
}

export function ActionCard({ action }: ActionCardProps) {
  const [status, setStatus] = useState(action.status)
  const producerName = extractProducerName(action.assigned_producer)
  const captions = extractCaptions(action.payload)
  const captionPlatforms = Object.keys(captions)

  return (
    <div className={cn('av2-pane overflow-hidden', status === 'killed' && 'opacity-60')}>
      {/* Top bar */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-start gap-3">
          {status !== 'killed' && <BulkSelectCheckbox actionId={action.id} />}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span style={{ fontWeight: 600, color: 'var(--a-text)' }}>{producerName}</span>
              <span className="av2-chip" style={{ cursor: 'default' }}>
                {action.action_type}
              </span>
              <StateWord state={STATUS_STATE[status] ?? 'ok'}>{status}</StateWord>
            </div>
            {action.target && (
              <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                Target: <span style={META_VALUE_STYLE}>{action.target}</span>
              </p>
            )}
            {action.generation_reason && (
              <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                {action.generation_reason}
              </p>
            )}
          </div>

          {/* Impact + cost */}
          <div className="shrink-0 space-y-1 text-right">
            {action.priority_score != null && (
              <div style={META_STYLE}>
                Priority: <span style={META_VALUE_STYLE}>{action.priority_score}</span>
              </div>
            )}
            {action.predicted_north_star_impact != null && (
              <div style={META_STYLE}>
                Est. impact:{' '}
                <span style={META_VALUE_STYLE}>
                  {action.predicted_north_star_impact} seller leads
                </span>
              </div>
            )}
            {action.cost_estimate_usd != null && (
              <div style={META_STYLE}>
                Cost est.:{' '}
                <span style={META_VALUE_STYLE}>${action.cost_estimate_usd.toFixed(2)}</span>
              </div>
            )}
            {action.executed_at && (
              <div style={META_STYLE}>{new Date(action.executed_at).toLocaleString()}</div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Media preview */}
        <MediaPreview
          actionType={action.action_type}
          executorResponse={action.executor_response}
        />

        {/* Per-platform captions */}
        {captionPlatforms.length > 0 && (
          <div className="space-y-2">
            <p
              className="uppercase tracking-wide"
              style={{ fontSize: 'var(--a-text-xs)', fontWeight: 600, color: 'var(--a-text-2)' }}
            >
              Captions
            </p>
            {captionPlatforms.map((platform) => (
              <CaptionDisclosure
                key={platform}
                platform={platform}
                text={captions[platform]}
              />
            ))}
          </div>
        )}

        <Rule />

        {/* Action buttons */}
        <ActionButtons
          actionId={action.id}
          producerSlug={action.assigned_producer ?? ''}
          onStatusChange={setStatus}
        />

        <Rule />

        {/* Comments thread */}
        <CommentsThread
          actionId={action.id}
          comments={action.comments ?? []}
        />
      </div>
    </div>
  )
}

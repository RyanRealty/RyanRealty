'use client'

/**
 * MobileAiPills — the §26-F / §27 S3 AI suggestion pill strip.
 *
 * Horizontally scrollable pills: ✦ Introduction · ✦ Follow Up · ✦ Still Buying ·
 * + Custom. Tapping a ✦ pill asks the server action for a Claude-drafted SMS and
 * injects it into the compose field — the broker ALWAYS reviews and edits before
 * sending (auto-send of AI content is prohibited, §27 S3 step 6). Custom opens a
 * one-line prompt input. Selected pill = navy fill (the RR mapping of FUB's
 * purple gradient, per the §27 design-token table).
 */

import { useState, useTransition } from 'react'
import { Loader2, Plus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AiDraftKind } from '@/app/actions/crm-inbox'

const PILLS: Array<{ kind: AiDraftKind; label: string }> = [
  { kind: 'introduction', label: 'Introduction' },
  { kind: 'follow_up', label: 'Follow Up' },
  { kind: 'still_buying', label: 'Still Buying' },
]

export default function MobileAiPills({
  aiDraftAction,
  onDraft,
}: {
  aiDraftAction: (kind: AiDraftKind, customPrompt?: string) => Promise<{ ok: true; draft: string } | { ok: false; error: string }>
  onDraft: (text: string) => void
}) {
  const [active, setActive] = useState<AiDraftKind | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(kind: AiDraftKind, prompt?: string) {
    setActive(kind)
    setError(null)
    startTransition(async () => {
      const res = await aiDraftAction(kind, prompt)
      if (res.ok) onDraft(res.draft)
      else setError(res.error)
      setActive(null)
    })
  }

  return (
    <div className="mb-2">
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-1">
        {PILLS.map((p) => {
          const isActive = pending && active === p.kind
          return (
            <button
              key={p.kind}
              type="button"
              disabled={pending}
              onClick={() => run(p.kind)}
              className={cn(
                'flex h-[34px] shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground',
              )}
            >
              {isActive ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              )}
              {p.label}
            </button>
          )
        })}
        <button
          type="button"
          disabled={pending}
          onClick={() => setCustomOpen((v) => !v)}
          className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Custom
        </button>
      </div>
      {customOpen ? (
        <form
          className="mt-1.5 flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (customPrompt.trim()) run('custom', customPrompt.trim())
          }}
        >
          <Input
            autoFocus
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="What should the text say?"
            className="h-9 text-sm"
          />
          <Button type="submit" size="sm" disabled={pending || !customPrompt.trim()}>
            Draft
          </Button>
        </form>
      ) : null}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

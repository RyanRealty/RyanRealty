'use client'

/**
 * MobileAiPills — the §26-F / §27 S3 AI suggestion pill strip.
 *
 * Horizontally scrollable pills: ✦ Introduction · ✦ Follow Up · ✦ Still Buying ·
 * + Custom. Tapping a ✦ pill asks the server action for a Claude-drafted SMS and
 * injects it into the compose field — the broker ALWAYS reviews and edits before
 * sending (auto-send of AI content is prohibited, §27 S3 step 6). Custom opens a
 * one-line prompt input. Selected pill = the one admin accent (admin v2 re-skin,
 * P11F — was a navy fill mapped from CRM's purple gradient; the admin blacklists
 * the public brand, so the "selected" state now reads through av2-chip's own
 * pressed styling instead).
 */

import { useState, useTransition } from 'react'
import { Loader2, Plus, Sparkles } from 'lucide-react'
import { Button, FilterChip, TextField } from '@/components/admin/v2'
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
            <FilterChip
              key={p.kind}
              pressed={isActive}
              disabled={pending}
              onClick={() => run(p.kind)}
              className="flex h-[34px] shrink-0 items-center gap-1.5"
            >
              {isActive ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              )}
              {p.label}
            </FilterChip>
          )
        })}
        <FilterChip
          pressed={customOpen}
          disabled={pending}
          onClick={() => setCustomOpen((v) => !v)}
          className="flex h-[34px] shrink-0 items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Custom
        </FilterChip>
      </div>
      {customOpen ? (
        <form
          className="mt-1.5 flex items-end gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (customPrompt.trim()) run('custom', customPrompt.trim())
          }}
        >
          <div className="flex-1">
            <TextField
              label="Custom prompt"
              autoFocus
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="What should the text say?"
            />
          </div>
          <Button type="submit" touch disabled={pending || !customPrompt.trim()}>
            Draft
          </Button>
        </form>
      ) : null}
      {error ? (
        <p className="mt-1" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

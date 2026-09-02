'use client'

/**
 * TextDraftTools — AI draft pills + the SMS template picker for the text mode
 * of ComposeSurface. Ported from the retired /admin/crm/inbox compose sheet
 * (Messages-fold final slice) so the fold loses no drafting capability: the
 * pills ask aiSmsDraftAction for a Claude draft, a template renders its merge
 * tokens per contact through renderSmsTemplateAction, and either path only
 * FILLS the editable textarea. The broker always reviews and edits before
 * sending — nothing here sends (spec §27 S3 step 6).
 */
import { useState, useTransition } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button, FilterChip, TextField } from '@/components/admin/v2'
import { cn } from '@/lib/utils'
import {
  aiSmsDraftAction,
  getSmsComposeTemplatesAction,
  renderSmsTemplateAction,
  type AiDraftKind,
} from '@/app/actions/crm-inbox'

const SMS_AI_PILLS: Array<{ kind: AiDraftKind; label: string }> = [
  { kind: 'introduction', label: 'Introduction' },
  { kind: 'follow_up', label: 'Follow Up' },
  { kind: 'still_buying', label: 'Still Buying' },
]

type Template = { key: string; name: string; body: string }

export function TextDraftTools({
  personId,
  onDraft,
}: {
  personId: number
  onDraft: (body: string) => void
}) {
  const [active, setActive] = useState<string | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function runAi(kind: AiDraftKind, prompt?: string) {
    setActive(kind)
    setError(null)
    startTransition(async () => {
      const res = await aiSmsDraftAction(personId, kind, prompt)
      if (res.ok) {
        onDraft(res.draft)
        setCustomOpen(false)
        setCustomPrompt('')
      } else setError(res.error)
      setActive(null)
    })
  }

  function openTemplates() {
    const next = !templatesOpen
    setTemplatesOpen(next)
    if (next && templates === null) {
      startTransition(async () => {
        const res = await getSmsComposeTemplatesAction()
        if (res.ok) setTemplates(res.templates)
        else setError(res.error)
      })
    }
  }

  function applyTemplate(t: Template) {
    setActive(t.key)
    setError(null)
    startTransition(async () => {
      const res = await renderSmsTemplateAction(personId, t.body)
      if (res.ok) {
        onDraft(res.body)
        setTemplatesOpen(false)
        if (res.unresolved.length > 0) {
          toast.warning(`Unfilled tokens for this contact: ${res.unresolved.join(', ')}`)
        }
      } else setError(res.error)
      setActive(null)
    })
  }

  return (
    <div className="space-y-1.5">
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-0.5">
        {SMS_AI_PILLS.map((p) => {
          const isActive = pending && active === p.kind
          return (
            <FilterChip
              key={p.kind}
              pressed={isActive}
              disabled={pending}
              onClick={() => runAi(p.kind)}
              className={cn('inline-flex shrink-0 items-center gap-1', !pending && 'hover:opacity-80')}
            >
              {isActive ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-3 w-3" aria-hidden />
              )}
              {p.label}
            </FilterChip>
          )
        })}
        <FilterChip
          pressed={customOpen}
          disabled={pending}
          onClick={() => setCustomOpen((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1"
        >
          <Sparkles className="h-3 w-3" aria-hidden />
          Custom
        </FilterChip>
        <FilterChip
          pressed={templatesOpen}
          disabled={pending}
          onClick={openTemplates}
          className="shrink-0"
        >
          Templates
        </FilterChip>
      </div>
      {customOpen ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <TextField
              label="What should the text say"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={pending}
            />
          </div>
          <Button
            type="button"
            variant="quiet"
            disabled={pending || customPrompt.trim().length === 0}
            onClick={() => runAi('custom', customPrompt.trim())}
          >
            Draft
          </Button>
        </div>
      ) : null}
      {templatesOpen ? (
        templates === null ? (
          <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>Loading templates…</p>
        ) : templates.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>No text templates yet.</p>
        ) : (
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-0.5">
            {templates.map((t) => (
              <FilterChip
                key={t.key}
                pressed={pending && active === t.key}
                disabled={pending}
                onClick={() => applyTemplate(t)}
                className="shrink-0"
              >
                {t.name}
              </FilterChip>
            ))}
          </div>
        )
      ) : null}
      {error ? (
        <p role="alert" style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

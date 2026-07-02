'use client'

/**
 * MergeFieldPicker — click-to-insert merge-token chip palette.
 *
 * Renders a flat row of chips grouped by token category (contact / property /
 * cma). Clicking a chip calls onInsert(token) — the caller is responsible for
 * inserting the token at the cursor position in whatever textarea it controls.
 *
 * Props:
 *   channel   — 'email' | 'sms' — CMA tokens are hidden for SMS (no link click)
 *   onInsert  — called with the raw token string, e.g. '%contact_first_name%'
 */
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { MERGE_TOKENS, type MergeToken } from '@/lib/crm/merge'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const GROUP_LABEL: Record<MergeToken['group'], string> = {
  contact: 'Contact',
  agent: 'Agent',
  sender: 'Sender',
  company: 'Company',
  lender: 'Lender',
  property: 'Property',
  lead_source: 'Lead source',
  cma: 'CMA',
  other: 'Other',
}

const GROUP_ORDER: MergeToken['group'][] = [
  'contact',
  'agent',
  'sender',
  'company',
  'lender',
  'property',
  'lead_source',
  'cma',
  'other',
]

export function MergeFieldPicker({
  channel,
  onInsert,
  className,
}: {
  channel: 'email' | 'sms'
  onInsert: (token: string) => void
  className?: string
}) {
  // Hide CMA link tokens for SMS — they render as unclickable text in messages.
  const tokens = MERGE_TOKENS.filter((t) => channel === 'email' || t.group !== 'cma')

  // Group tokens preserving GROUP_ORDER.
  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    tokens: tokens.filter((t) => t.group === g),
  })).filter((g) => g.tokens.length > 0)

  // P2-6 (2026-07-02 mobile audit): at <md the full chip palette pushed the
  // message field below the fold, so it starts collapsed behind a disclosure
  // row. md+ keeps the always-expanded desktop behavior (CSS-only — no
  // hydration flash). The toggle itself only renders under md.
  const [mobileExpanded, setMobileExpanded] = useState(false)

  return (
    <div className={cn('space-y-1.5', className)}>
      <button
        type="button"
        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:hidden"
        aria-expanded={mobileExpanded}
        onClick={() => setMobileExpanded((v) => !v)}
      >
        Merge fields
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', mobileExpanded && 'rotate-180')} aria-hidden />
      </button>
      <p className="hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:block">
        Merge fields. Click to insert at cursor.
      </p>
      <div className={cn('flex-wrap gap-x-4 gap-y-2', mobileExpanded ? 'flex' : 'hidden md:flex')}>
        {groups.map(({ group, tokens: gtokens }) => (
          <div key={group} className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {GROUP_LABEL[group]}
            </span>
            {gtokens.map((t) => (
              <button
                key={t.token}
                type="button"
                onClick={() => onInsert(t.token)}
                className="inline-flex"
                aria-label={`Insert ${t.label} merge field`}
              >
                <Badge
                  variant="outline"
                  className="cursor-pointer font-mono text-[11px] transition-colors hover:bg-primary hover:text-primary-foreground active:scale-95"
                >
                  {t.label}
                </Badge>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * insertAtCursor — utility for inserting a token at the current cursor position
 * in a textarea. Pass a React ref to the textarea and the token string.
 * Returns the new full string value after insertion.
 */
export function insertAtCursor(
  el: HTMLTextAreaElement,
  token: string,
): string {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  const before = el.value.slice(0, start)
  const after = el.value.slice(end)
  return before + token + after
}

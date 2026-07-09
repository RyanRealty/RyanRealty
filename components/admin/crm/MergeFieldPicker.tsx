'use client'

/**
 * MergeFieldPicker — "Insert field" dropdown of merge tokens, grouped by
 * category (contact / agent / property / …). Selecting an item calls
 * onInsert(token) — the caller inserts at the cursor in whatever textarea it
 * controls.
 *
 * Was a flat chip palette; converted to a dropdown 2026-07-09 (Matt directive:
 * "the pills in the merge fields are dumb — put those in a drop down").
 *
 * Props:
 *   channel   — 'email' | 'sms' — CMA tokens are hidden for SMS (no link click)
 *   onInsert  — called with the raw token string, e.g. '%contact_first_name%'
 */
import { Braces, ChevronDown } from 'lucide-react'
import { MERGE_TOKENS, type MergeToken } from '@/lib/crm/merge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  iconOnly = false,
}: {
  channel: 'email' | 'sms'
  onInsert: (token: string) => void
  className?: string
  /** Round icon trigger for tight chat bars (the SMS composer's + button). */
  iconOnly?: boolean
}) {
  // Hide CMA link tokens for SMS — they render as unclickable text in messages.
  const tokens = MERGE_TOKENS.filter((t) => channel === 'email' || t.group !== 'cma')

  // Group tokens preserving GROUP_ORDER.
  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    tokens: tokens.filter((t) => t.group === g),
  })).filter((g) => g.tokens.length > 0)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {iconOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Insert merge field"
            className={cn('h-9 w-9 shrink-0 rounded-full', className)}
          >
            <Braces className="h-5 w-5" aria-hidden />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('h-8 gap-1.5 rounded-full px-3 text-xs', className)}
          >
            <Braces className="h-3.5 w-3.5" aria-hidden />
            Insert field
            <ChevronDown className="h-3 w-3" aria-hidden />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
        {groups.map(({ group, tokens: gtokens }, i) => (
          <div key={group}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {GROUP_LABEL[group]}
            </DropdownMenuLabel>
            {gtokens.map((t) => (
              <DropdownMenuItem key={t.token} onSelect={() => onInsert(t.token)} className="flex items-center justify-between gap-3">
                <span className="text-sm">{t.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{t.token}</span>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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

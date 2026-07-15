'use client'

/**
 * MergeFieldInserter — THE merge-token dropdown, shared by every surface that
 * inserts merge fields (template modals + one-off composers).
 *
 * Consolidation 2026-07-14: this replaces the near-duplicate MergeFieldPicker
 * (composers) + settings/templates/MergeFieldInserter (template editors),
 * which had already drifted — composers could not insert custom-field tokens
 * while template editors could. One component now serves both call sites.
 *
 * A design-system DropdownMenu grouping every token by catalog category
 * (Contact, Company, Agent, Lender, Sender, Property, Last Viewed, Lead
 * Source, CMA, Other) plus a Custom Fields group built from the live
 * crm_field_definitions rows. Clicking a token calls onInsert(token) — the
 * caller inserts `%field_name%` at the cursor of whatever field it controls
 * (§13.9 AC: percent-delimited, grouped by category).
 *
 * SMS hides the CMA group (links are not clickable text in messages) — same
 * rule the legacy chip palette applied.
 *
 * Props:
 *   channel      — 'email' | 'sms' — CMA tokens are hidden for SMS
 *   customFields — live crm_field_definitions (key starts with 'custom');
 *                  optional — surfaces without defs just omit the group
 *   onInsert     — called with the raw token string, e.g. '%contact_first_name%'
 *   iconOnly     — round braces-icon trigger for tight chat bars (the SMS
 *                  composer's + button); default is the "Merge Fields" button
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

export type CustomFieldToken = { key: string; label: string }

const GROUP_LABEL: Record<MergeToken['group'], string> = {
  contact: 'Contact',
  company: 'Company',
  agent: 'Agent',
  lender: 'Lender',
  sender: 'Sender',
  property: 'Property',
  lead_source: 'Lead Source',
  cma: 'CMA',
  other: 'Other',
}

// §13.3.1 category order. Last Viewed renders as its own group (the catalog
// stores last_viewed_address under property; the dropdown splits it out).
const GROUP_ORDER: MergeToken['group'][] = [
  'contact',
  'company',
  'agent',
  'lender',
  'sender',
  'property',
  'lead_source',
  'cma',
  'other',
]

export function MergeFieldInserter({
  channel,
  customFields = [],
  onInsert,
  size = 'sm',
  iconOnly = false,
  className,
}: {
  channel: 'email' | 'sms'
  /** Live crm_field_definitions (key starts with 'custom') → Custom Fields group. */
  customFields?: CustomFieldToken[]
  onInsert: (token: string) => void
  size?: 'sm' | 'default'
  /** Round icon trigger for tight chat bars (the SMS composer's braces button). */
  iconOnly?: boolean
  className?: string
}) {
  const tokens = MERGE_TOKENS.filter((t) => channel === 'email' || t.group !== 'cma')
  const lastViewed = tokens.filter((t) => t.token === '%last_viewed_address%')
  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    label: GROUP_LABEL[g],
    tokens: tokens.filter((t) => t.group === g && t.token !== '%last_viewed_address%'),
  })).filter((g) => g.tokens.length > 0)

  const customTokens = customFields.filter((f) => f.key.startsWith('custom'))

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
          <Button type="button" variant="outline" size={size} className={cn('gap-1', className)}>
            Merge Fields
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-72 overflow-y-auto">
        {groups.map(({ group, label, tokens: gtokens }, i) => (
          <div key={group}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </DropdownMenuLabel>
            {gtokens.map((t) => (
              <DropdownMenuItem
                key={t.token}
                onSelect={() => onInsert(t.token)}
                className="flex items-center justify-between gap-3"
              >
                <span>{t.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{t.token}</span>
              </DropdownMenuItem>
            ))}
            {group === 'property' && lastViewed.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                  Last Viewed
                </DropdownMenuLabel>
                {lastViewed.map((t) => (
                  <DropdownMenuItem
                    key={t.token}
                    onSelect={() => onInsert(t.token)}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>{t.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">{t.token}</span>
                  </DropdownMenuItem>
                ))}
              </>
            ) : null}
          </div>
        ))}
        {customTokens.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
              Custom Fields
            </DropdownMenuLabel>
            {customTokens.map((f) => (
              <DropdownMenuItem
                key={f.key}
                onSelect={() => onInsert(`%${f.key}%`)}
                className="flex items-center justify-between gap-3"
              >
                <span>{f.label}</span>
                <span className="truncate font-mono text-xs text-muted-foreground">{`%${f.key}%`}</span>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * insertAtCursor — utility for inserting a token at the current cursor position
 * in a textarea. Pass the textarea element and the token string.
 * Returns the new full string value after insertion.
 */
export function insertAtCursor(el: HTMLTextAreaElement, token: string): string {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  const before = el.value.slice(0, start)
  const after = el.value.slice(end)
  return before + token + after
}

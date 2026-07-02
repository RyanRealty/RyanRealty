'use client'

/**
 * MergeFieldInserter — the §13.3 "Merge Fields ▾" dropdown.
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
 */
import { ChevronDown } from 'lucide-react'
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
}: {
  channel: 'email' | 'sms'
  /** Live crm_field_definitions (key starts with 'custom') → Custom Fields group. */
  customFields?: CustomFieldToken[]
  onInsert: (token: string) => void
  size?: 'sm' | 'default'
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
        <Button type="button" variant="outline" size={size} className="gap-1">
          Merge Fields
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
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

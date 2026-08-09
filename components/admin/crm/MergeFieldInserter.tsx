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
 * A dropdown grouping every token by catalog category (Contact, Company,
 * Agent, Lender, Sender, Property, Last Viewed, Lead Source, CMA, Other) plus
 * a Custom Fields group built from the live crm_field_definitions rows.
 * Clicking a token calls onInsert(token) — the caller inserts `%field_name%`
 * at the cursor of whatever field it controls (§13.9 AC: percent-delimited,
 * grouped by category).
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
 *
 * ── Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY. Every exported name, prop, token filter, group order and
 * onInsert call is byte-for-byte what it was; this file is mounted by the G50
 * compose chokepoints (EmailBodyEditor, SmsComposer) and by both template
 * modals, so a behaviour change here reaches every send path in the admin.
 *
 * WHY THE BEHAVIOUR PRIMITIVE STAYED AND ONLY THE SKIN CHANGED. The v2 barrel's
 * Menu is a FLAT list of string-labelled actions behind an icon-only
 * `av2-iconbtn` trigger. This control is a ~50-token catalog in ten labelled
 * groups, each row a label plus its mono token, behind a text trigger — the
 * primitive cannot express it, and flattening the catalog would bury the
 * grouping a broker navigates by. The alternative, hand-rolling the panel with
 * `.av2-menu__panel`, is `position:absolute`: it would be clipped by the
 * `overflow-x:auto` box /admin/email/compose wraps this editor in, and it would
 * open DOWNWARD off-screen from the SMS chat bar, which sits at the bottom of
 * the viewport. So the unstyled behaviour primitive (portal, collision flip,
 * roving focus, Escape, outside-click) is kept exactly as it was and every
 * shadcn class it used to carry is replaced by an admin token. What the gate
 * bans is components/ui — the SKIN that renders the public brand palette — and
 * that import is gone.
 */
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import { Braces, ChevronDown } from 'lucide-react'
import { MERGE_TOKENS, type MergeToken } from '@/lib/crm/merge'
import { Button, IconButton } from '@/components/admin/v2'
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

/**
 * The panel carries `.av2-menu__panel`'s tokens inline rather than the class
 * itself: that class is `position:absolute; top:calc(100% + 4px)` for the
 * hand-rolled v2 Menu, and it also keys off `[data-align]`, which this panel
 * sets for a different purpose. Applying it would fight the positioner. Same
 * surface, same border, same overlay shadow — §2 sanctions shadows on overlays.
 * fontFamily is explicit because the panel portals out of `.av2-scope`.
 */
const PANEL_STYLE: React.CSSProperties = {
  zIndex: 30,
  display: 'flex',
  flexDirection: 'column',
  padding: 'var(--a-s1)',
  fontFamily: 'var(--a-font)',
  background: 'var(--a-bg)',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-md)',
  boxShadow: 'var(--a-shadow-overlay)',
}

/** Group heading — the uppercase meta label the language uses for lane heads. */
const GROUP_STYLE: React.CSSProperties = {
  padding: '6px var(--a-s3) 2px',
  fontSize: 'var(--a-text-xs)',
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--a-text-2)',
}

/** Hairline between groups (elevation is borders first). */
const SEPARATOR_STYLE: React.CSSProperties = {
  height: 1,
  margin: '4px -4px',
  background: 'var(--a-border)',
}

/** The token itself, in the admin's mono face — an identifier, not prose. */
const TOKEN_STYLE: React.CSSProperties = {
  fontFamily: 'var(--a-font-mono)',
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
}

export function MergeFieldInserter({
  channel,
  customFields = [],
  onInsert,
  iconOnly = false,
  className,
}: {
  channel: 'email' | 'sms'
  /** Live crm_field_definitions (key starts with 'custom') → Custom Fields group. */
  customFields?: CustomFieldToken[]
  onInsert: (token: string) => void
  /**
   * Still accepted so no caller's type breaks, and deliberately not read: the
   * v2 button carries ONE locked height (36px, 44px on a touch-primary
   * surface), so there is no second metric to swap to. No call site passes it.
   */
  /* `size` was removed in the 11F migration: it survived in the type while the
     destructure dropped it, so it was declared API that silently did nothing.
     No call site passed it (EmailBodyEditor, SmsComposer, ProspectSendDialog,
     EmailTemplateModal x3, TextTemplateModal all omit it). A prop that cannot
     affect the render is worse than no prop — the next caller gets silence
     instead of a type error. */
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
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        {iconOnly ? (
          // The 36px circle is the chat bar's own metric — it sits beside a
          // 36px round paperclip, so the shape is preserved inline. Nothing
          // here paints background or colour, so `.av2-iconbtn`'s hover state
          // (inset wash + full-strength text) still fires.
          <IconButton
            label="Insert merge field"
            className={cn('shrink-0', className)}
            style={{ width: 36, height: 36, borderRadius: '50%' }}
          >
            <Braces className="h-5 w-5" aria-hidden />
          </IconButton>
        ) : (
          // hover:opacity-80 as a utility, never an inline background: the old
          // outline button dimmed on hover, and an inline value here would
          // outrank any stylesheet hover rule that replaced it.
          <Button type="button" variant="quiet" className={cn('hover:opacity-80', className)}>
            Merge Fields
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        )}
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={4}
          className="max-h-96 w-72 overflow-y-auto"
          style={PANEL_STYLE}
        >
          {groups.map(({ group, label, tokens: gtokens }, i) => (
            <div key={group}>
              {i > 0 ? <DropdownMenuPrimitive.Separator style={SEPARATOR_STYLE} /> : null}
              <DropdownMenuPrimitive.Label style={GROUP_STYLE}>{label}</DropdownMenuPrimitive.Label>
              {gtokens.map((t) => (
                <DropdownMenuPrimitive.Item
                  key={t.token}
                  onSelect={() => onInsert(t.token)}
                  className="av2-menu__item justify-between"
                >
                  <span>{t.label}</span>
                  <span style={TOKEN_STYLE}>{t.token}</span>
                </DropdownMenuPrimitive.Item>
              ))}
              {group === 'property' && lastViewed.length > 0 ? (
                <>
                  <DropdownMenuPrimitive.Separator style={SEPARATOR_STYLE} />
                  <DropdownMenuPrimitive.Label style={GROUP_STYLE}>Last Viewed</DropdownMenuPrimitive.Label>
                  {lastViewed.map((t) => (
                    <DropdownMenuPrimitive.Item
                      key={t.token}
                      onSelect={() => onInsert(t.token)}
                      className="av2-menu__item justify-between"
                    >
                      <span>{t.label}</span>
                      <span style={TOKEN_STYLE}>{t.token}</span>
                    </DropdownMenuPrimitive.Item>
                  ))}
                </>
              ) : null}
            </div>
          ))}
          {customTokens.length > 0 ? (
            <>
              <DropdownMenuPrimitive.Separator style={SEPARATOR_STYLE} />
              <DropdownMenuPrimitive.Label style={GROUP_STYLE}>Custom Fields</DropdownMenuPrimitive.Label>
              {customTokens.map((f) => (
                <DropdownMenuPrimitive.Item
                  key={f.key}
                  onSelect={() => onInsert(`%${f.key}%`)}
                  className="av2-menu__item justify-between"
                >
                  <span>{f.label}</span>
                  <span className="truncate" style={TOKEN_STYLE}>{`%${f.key}%`}</span>
                </DropdownMenuPrimitive.Item>
              ))}
            </>
          ) : null}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
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

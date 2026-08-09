'use client'

/**
 * RecipientField — one To/Cc/Bcc row of the email composer: address chips, a
 * type-ahead input (Enter/comma/blur commits), and a dropdown of known
 * addresses (the contact's emails + linked people). Posts its value as a
 * hidden JSON field the send action re-validates (lib/crm/email-recipients).
 *
 * ── Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY. Every exported name, prop, commit rule, key handler and
 * posted field name is what it was; this row feeds EmailComposer, a G50 send
 * chokepoint.
 *
 * Three notes on HOW, because each is a trap:
 *  - The row's own input is UNLABELLED by design (the "To" caption sits beside
 *    it and the input already carries aria-label="To recipients"), so it
 *    is SearchField, the barrel's unlabelled field, not TextField. It sits
 *    INSIDE a bordered row, so its own border and background are cleared
 *    inline — an input drawing `av2-input`'s box inside the row would be a
 *    second frame around a frame. Nothing else is set inline, so the
 *    `.av2-input:focus-visible` ring the language requires still fires (the
 *    shadcn original suppressed it with focus-visible:ring-0).
 *  - The posted value rides a `type="hidden"` SearchField rather than a raw
 *    input element: the barrel has no hidden-field primitive, and this file
 *    carries no design-token debt to spend on adding a raw element to it.
 *  - The "Add" dropdown keeps the unstyled radix behaviour primitive and swaps
 *    only its skin, exactly as MergeFieldInserter does in this folder. The v2
 *    Menu was the obvious target and is the wrong shape: its trigger is the
 *    fixed-size `av2-iconbtn`, and this trigger carries the visible word "Add".
 */
import { useState } from 'react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import { ChevronDown, X } from 'lucide-react'
import { isValidEmailAddress, normalizeEmailAddress, MAX_RECIPIENTS_PER_FIELD } from '@/lib/crm/email-recipients'
import { Button, IconButton, SearchField } from '@/components/admin/v2'
import { cn } from '@/lib/utils'

export type RecipientOption = { email: string; label: string }

/**
 * The panel carries `.av2-menu__panel`'s tokens inline rather than the class
 * itself: that class is `position:absolute; top:calc(100% + 4px)` for the
 * hand-rolled v2 Menu and would fight radix's positioner. Same surface, same
 * border, same overlay shadow — §2 sanctions shadows on overlays. fontFamily is
 * explicit because the panel portals out of any `.av2-scope` above it.
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

export function RecipientField(props: {
  /** Form field name: 'to' | 'cc' | 'bcc'. */
  name: string
  label: string
  values: string[]
  onChange: (next: string[]) => void
  /** Known addresses to offer in the picker (contact's emails, linked people). */
  options?: RecipientOption[]
  /** Shown as a ghost hint when the row is empty (e.g. the default primary). */
  placeholder?: string
  className?: string
}) {
  const [draft, setDraft] = useState('')
  const [invalid, setInvalid] = useState(false)

  function commit(raw: string) {
    const value = normalizeEmailAddress(raw)
    if (!value) return
    if (!isValidEmailAddress(value)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    if (!props.values.includes(value) && props.values.length < MAX_RECIPIENTS_PER_FIELD) {
      props.onChange([...props.values, value])
    }
    setDraft('')
  }

  const remaining = (props.options ?? []).filter((o) => !props.values.includes(normalizeEmailAddress(o.email)))

  return (
    <div
      className={cn('flex items-start gap-2 pb-1.5', props.className)}
      style={{ borderBottom: '1px solid var(--a-border)' }}
    >
      <span className="mt-1.5 w-8 shrink-0 text-xs" style={{ color: 'var(--a-text-2)' }}>
        {props.label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        <SearchField
          type="hidden"
          aria-label={`${props.label} recipients value`}
          name={props.name}
          value={props.values.length ? JSON.stringify(props.values) : ''}
          readOnly
        />
        {props.values.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
            style={{ border: '1px solid var(--a-border)', color: 'var(--a-text)' }}
          >
            <span className="max-w-56 truncate">{v}</span>
            {/* 16px keeps the chip's metric; nothing here paints colour, so the
                iconbtn hover (full-strength text + inset wash) still fires. */}
            <IconButton
              label={`Remove ${v}`}
              onClick={() => props.onChange(props.values.filter((x) => x !== v))}
              className="shrink-0"
              style={{ width: 16, height: 16 }}
            >
              <X className="h-3 w-3" aria-hidden />
            </IconButton>
          </span>
        ))}
        <SearchField
          type="text"
          inputMode="email"
          autoComplete="off"
          value={draft}
          placeholder={props.values.length === 0 ? props.placeholder : undefined}
          onChange={(e) => { setDraft(e.target.value); setInvalid(false) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              commit(draft)
            } else if (e.key === 'Backspace' && !draft && props.values.length) {
              props.onChange(props.values.slice(0, -1))
            }
          }}
          onBlur={() => { if (draft.trim()) commit(draft) }}
          aria-label={`${props.label} recipients`}
          aria-invalid={invalid}
          className="min-w-40 flex-1 text-sm"
          style={{
            border: 'none',
            background: 'transparent',
            minHeight: 28,
            maxWidth: 'none',
            padding: '4px',
            color: invalid ? 'var(--a-danger)' : 'var(--a-text)',
          }}
        />
      </div>
      {remaining.length > 0 ? (
        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger asChild>
            {/* hover:opacity-80 as a utility, never an inline background: the old
                ghost button dimmed on hover, and an inline value here would
                outrank any stylesheet hover rule that replaced it. */}
            <Button type="button" variant="quiet" className="shrink-0 hover:opacity-80">
              Add
              <ChevronDown className="h-3 w-3" aria-hidden />
            </Button>
          </DropdownMenuPrimitive.Trigger>
          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
              align="end"
              sideOffset={4}
              className="max-h-72 overflow-y-auto"
              style={PANEL_STYLE}
            >
              {remaining.map((o) => (
                <DropdownMenuPrimitive.Item
                  key={o.email}
                  onSelect={() => commit(o.email)}
                  className="av2-menu__item"
                >
                  <span className="flex flex-col">
                    <span className="text-sm">{o.label}</span>
                    {o.label !== o.email ? (
                      <span className="text-xs" style={{ color: 'var(--a-text-2)' }}>{o.email}</span>
                    ) : null}
                  </span>
                </DropdownMenuPrimitive.Item>
              ))}
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>
      ) : null}
    </div>
  )
}

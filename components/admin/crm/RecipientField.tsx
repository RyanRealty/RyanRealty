'use client'

/**
 * RecipientField — one To/Cc/Bcc row of the email composer: address chips, a
 * type-ahead input (Enter/comma/blur commits), and a dropdown of known
 * addresses (the contact's emails + linked people). Posts its value as a
 * hidden JSON field the send action re-validates (lib/crm/email-recipients).
 */
import { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { isValidEmailAddress, normalizeEmailAddress, MAX_RECIPIENTS_PER_FIELD } from '@/lib/crm/email-recipients'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type RecipientOption = { email: string; label: string }

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
    <div className={cn('flex items-start gap-2 border-b border-border pb-1.5', props.className)}>
      <span className="mt-1.5 w-8 shrink-0 text-xs text-muted-foreground">{props.label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        <Input type="hidden" name={props.name} value={props.values.length ? JSON.stringify(props.values) : ''} readOnly className="hidden" />
        {props.values.map((v) => (
          <Badge key={v} variant="outline" className="gap-1 font-normal">
            <span className="max-w-56 truncate">{v}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => props.onChange(props.values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden />
            </Button>
          </Badge>
        ))}
        <Input
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
          className={cn(
            'h-7 min-w-40 flex-1 border-0 bg-transparent px-1 py-1 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/70',
            invalid && 'text-destructive',
          )}
        />
      </div>
      {remaining.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground">
              Add
              <ChevronDown className="h-3 w-3" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
            {remaining.map((o) => (
              <DropdownMenuItem key={o.email} onSelect={() => commit(o.email)}>
                <span className="flex flex-col">
                  <span className="text-sm">{o.label}</span>
                  {o.label !== o.email ? <span className="text-xs text-muted-foreground">{o.email}</span> : null}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

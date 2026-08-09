'use client'

/**
 * SaveAsTemplateButton — the "tweaked a reply, keep it" affordance inside the
 * canonical composers (Matt gap 2026-07-21: a broker who edits a message could
 * not save it as a template without leaving the flow).
 *
 * A low-prominence button that opens a small name-prompt Dialog and persists
 * the CURRENT subject/body through createTemplateAction — the same gated write
 * path the template admin uses, so the brand-voice hard-fail gate and owner
 * stamping still apply:
 *   - owner_broker is stamped server-side from the session broker (scoped to
 *     the saving broker; is_shared stays false from this flow).
 *   - a body with an em dash / banned word is REFUSED by the voice gate and
 *     the error surfaces right in the dialog.
 *
 * Nothing saves without the explicit Save click, and nothing here sends —
 * this is a write to crm_templates only (no new send path, G50 intact).
 *
 * ── Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY: the exported name, the props, the validation, the
 * createTemplateAction payload and every string are what they were.
 *
 * Two notes on HOW:
 *  - The trigger keeps its low prominence through `av2-textlink`, the class the
 *    deals migration added for a v2 Button stripped to inline text. Stacking it
 *    on the quiet variant only overrides cosmetics, so `.av2-btn:focus-visible`
 *    still rings it.
 *  - The name box is SearchField (the barrel's UNLABELLED field) rather than
 *    TextField: this prompt never had a visible label above it — the dialog
 *    title and the placeholder are what name it — and dropping the visible
 *    label must never drop the accessible one, so the aria-label is required
 *    by the primitive's own type. The toolbar variant is capped at 200px and
 *    32px tall; both are lifted inline, since this is the dialog's one field.
 */

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { createTemplateAction } from '@/app/actions/crm-templates'
import { Button, Dialog, SearchField } from '@/components/admin/v2'
import { cn } from '@/lib/utils'

export function SaveAsTemplateButton(props: {
  channel: 'email' | 'sms'
  /** Current composer subject (email only — ignored for sms). */
  subject?: string
  /** Current composer body — saved exactly as typed (merge tokens stay tokens). */
  body: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function openDialog() {
    setName('')
    setError(null)
    setSaved(false)
    setOpen(true)
  }

  function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give the template a name')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createTemplateAction({
        channel: props.channel,
        name: trimmed,
        subject: props.channel === 'email' ? (props.subject ?? '') : null,
        body: props.body,
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setOpen(false), 900)
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="quiet"
        onClick={openDialog}
        className={cn('av2-textlink', props.className)}
      >
        Save as template
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Save as template"
        description={
          props.channel === 'email'
            ? 'Saves the current subject and body to your templates. Merge fields stay as tokens.'
            : 'Saves the current text to your templates. Merge fields stay as tokens.'
        }
        footer={
          <>
            <Button type="button" variant="quiet" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={pending || saved}>
              {pending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving…
                </span>
              ) : (
                'Save template'
              )}
            </Button>
          </>
        }
      >
        <SearchField
          type="text"
          aria-label="Template name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          disabled={pending || saved}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
          style={{
            width: '100%',
            maxWidth: 'none',
            minHeight: 'var(--a-touch)',
            fontSize: 'var(--a-text-md)',
          }}
        />
        {error ? <p className="text-sm" style={{ color: 'var(--a-danger)' }}>{error}</p> : null}
        {saved ? <p className="text-sm" style={{ color: 'var(--a-ok)' }}>Template created</p> : null}
      </Dialog>
    </>
  )
}

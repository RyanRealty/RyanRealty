'use client'

/**
 * SaveAsTemplateButton — the "tweaked a reply, keep it" affordance inside the
 * canonical composers (Matt gap 2026-07-21: a broker who edits a message could
 * not save it as a template without leaving the flow).
 *
 * A low-prominence ghost button that opens a small name-prompt Dialog and
 * persists the CURRENT subject/body through createTemplateAction — the same
 * gated write path the template admin uses, so the brand-voice hard-fail gate
 * and owner stamping still apply:
 *   - owner_broker is stamped server-side from the session broker (scoped to
 *     the saving broker; is_shared stays false from this flow).
 *   - a body with an em dash / banned word is REFUSED by the voice gate and
 *     the error surfaces right in the dialog.
 *
 * Nothing saves without the explicit Save click, and nothing here sends —
 * this is a write to crm_templates only (no new send path, G50 intact).
 */

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { createTemplateAction } from '@/app/actions/crm-templates'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
        variant="ghost"
        size="sm"
        onClick={openDialog}
        className={cn('text-muted-foreground', props.className)}
      >
        Save as template
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              {props.channel === 'email'
                ? 'Saves the current subject and body to your templates. Merge fields stay as tokens.'
                : 'Saves the current text to your templates. Merge fields stay as tokens.'}
            </DialogDescription>
          </DialogHeader>
          <Input
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
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {saved ? <p className="text-sm text-success">Template created</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={pending || saved}>
              {pending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving…
                </span>
              ) : (
                'Save template'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

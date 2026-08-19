'use client'

/**
 * AddPersonDialog — the §16 Add Person modal
 * (docs/crm-spec/05-people-list-and-bulk-actions.md).
 *
 * Minimal quick-create: First/Last name (50/50 row), Email, Phone, lead-source
 * dropdown. "Add person" (lowercase p, §16.5 label correction) is disabled
 * until a first name is entered; submit routes through createCrmContactAction
 * (CRM event + local mirror + dedupe) and navigates to the new Person Detail.
 *
 * 11F: migrated off shadcn onto the admin v2 language (Dialog / TextField /
 * SelectField / Button, design_system/admin/ADMIN_UI.md). Presentation only —
 * the create path, the disabled rule and every user-facing string are
 * unchanged. The v2 Dialog labels itself from a plain `title` string, so the
 * decorative UserRoundPlus glyph that sat beside the heading is gone; it was
 * aria-hidden and carried no meaning.
 *
 * WHEN THE DRAFT IS CLEARED. Radix fired its root onOpenChange only when the
 * USER dismissed the dialog, never when the parent flipped `open` — so Cancel
 * (which just calls the prop) kept whatever had been typed, and only Esc / the
 * close control wiped it. The v2 Dialog routes every close through one
 * onClose, so the two are told apart by the `open` prop as the handler runs:
 * still true = the user dismissed it, already false = the parent closed it.
 * Without that test Cancel destroyed a half-typed person.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createCrmContactAction } from '@/app/actions/crm'
import { Button, Dialog, SelectField, TextField } from '@/components/admin/v2'

export type AddPersonDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Configured lead sources for the §16 dropdown. */
  sources: Array<{ key: string; label: string }>
}

export default function AddPersonDialog({ open, onOpenChange, sources }: AddPersonDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setSource(''); setError(null)
  }

  const submit = () => {
    setError(null)
    const fd = new FormData()
    fd.set('firstName', firstName.trim())
    fd.set('lastName', lastName.trim())
    fd.set('email', email.trim())
    fd.set('phone', phone.trim())
    if (source) fd.set('source', source)
    startTransition(async () => {
      const res = await createCrmContactAction(fd)
      if (!res.ok) { setError(res.error ?? 'Could not add the person'); return }
      reset()
      onOpenChange(false)
      if (res.personId) router.push(`/admin/people/${res.personId}`)
      else router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      // `open` is still true when the user dismisses the dialog (Esc, the
      // header Close control) and already false when the close came from the
      // prop — Cancel and a successful submit. Only the first case clears the
      // draft, which is the Radix behaviour this replaced.
      onClose={() => { if (open) reset(); onOpenChange(false) }}
      title="Add Person"
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={submit} disabled={isPending || !firstName.trim()}>
            {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
            Add person
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <TextField label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <TextField label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" />
          </div>
        </div>
        <div>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <TextField label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <SelectField label="Lead source" value={source} onChange={(e) => setSource(e.target.value)}>
            {/* The Radix original showed this as a PLACEHOLDER, not a choice.
                disabled+hidden keeps it as the resting label of an unset
                select without offering "" back as a selectable option. */}
            <option value="" disabled hidden>Select a lead source</option>
            {sources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </SelectField>
        </div>
        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          An email or a phone number is required. If the person already exists, this updates them instead of creating a duplicate.
        </p>
        {error ? <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }} role="alert">{error}</p> : null}
      </div>
    </Dialog>
  )
}

'use client'

/**
 * New contact quick add. Name and phone, plus email or street.
 * After save, open person detail for stage, tags, related people, and notes.
 *
 * Cancel vs Esc: v2 Dialog routes every close through one onClose. The `open`
 * prop tells them apart — still true = user dismissed, already false = parent
 * closed. Without that test, Cancel wiped a half-typed person.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createQuickContactAction } from '@/app/actions/crm-quick-add'
import { canSubmitCreateContact } from '@/lib/crm/create-contact'
import { Button, Dialog, SectionHead, TextField } from '@/components/admin/v2'

function useAddPersonForm(onCreated: () => void) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('OR')
  const [zip, setZip] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ personId: number; name: string } | null>(null)

  const reset = () => {
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setStreet('')
    setCity('')
    setState('OR')
    setZip('')
    setError(null)
  }

  const submit = () => {
    setError(null)
    const fd = new FormData()
    fd.set('firstName', firstName.trim())
    fd.set('lastName', lastName.trim())
    fd.set('email', email.trim())
    fd.set('phone', phone.trim())
    fd.set('street', street.trim())
    fd.set('city', city.trim())
    fd.set('state', state.trim())
    fd.set('zip', zip.trim())
    startTransition(async () => {
      const res = await createQuickContactAction(fd)
      if (!res.ok) {
        setError(res.error ?? 'Could not add the person')
        return
      }
      const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
      reset()
      if (res.personId) {
        setCreated({ personId: res.personId, name: name || `Person ${res.personId}` })
        onCreated()
        router.push(`/admin/people/${res.personId}`)
        return
      }
      onCreated()
      router.refresh()
    })
  }

  return {
    isPending,
    firstName, setFirstName,
    lastName, setLastName,
    email, setEmail,
    phone, setPhone,
    street, setStreet,
    city, setCity,
    state, setState,
    zip, setZip,
    error,
    created,
    canSubmit: canSubmitCreateContact({ firstName, email, phone, street }),
    reset,
    submit,
  }
}

function AddPersonFields({ form }: { form: ReturnType<typeof useAddPersonForm> }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="First name"
          value={form.firstName}
          onChange={(e) => form.setFirstName(e.target.value)}
          autoComplete="off"
          autoFocus
        />
        <TextField
          label="Last name"
          value={form.lastName}
          onChange={(e) => form.setLastName(e.target.value)}
          autoComplete="off"
        />
      </div>
      <TextField
        label="Phone"
        type="tel"
        value={form.phone}
        onChange={(e) => form.setPhone(e.target.value)}
        autoComplete="off"
        required
      />
      <TextField
        label="Email"
        type="email"
        value={form.email}
        onChange={(e) => form.setEmail(e.target.value)}
        autoComplete="off"
      />
      <TextField
        label="Street"
        name="street"
        value={form.street}
        onChange={(e) => form.setStreet(e.target.value)}
        autoComplete="off"
      />
      <div className="grid grid-cols-[1fr_72px_88px] gap-3">
        <TextField
          label="City"
          name="city"
          value={form.city}
          onChange={(e) => form.setCity(e.target.value)}
          autoComplete="off"
        />
        <TextField
          label="State"
          name="state"
          value={form.state}
          onChange={(e) => form.setState(e.target.value)}
          autoComplete="off"
        />
        <TextField
          label="Zip"
          name="zip"
          value={form.zip}
          onChange={(e) => form.setZip(e.target.value)}
          autoComplete="off"
        />
      </div>
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        First name and phone, plus an email or a street. Stage, tags, related people, and notes open on the person after save.
      </p>
      {form.error ? (
        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }} role="alert">{form.error}</p>
      ) : null}
    </div>
  )
}

export type AddPersonDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function AddPersonDialog({
  open,
  onOpenChange,
}: AddPersonDialogProps) {
  const form = useAddPersonForm(() => onOpenChange(false))

  return (
    <Dialog
      open={open}
      onClose={() => { if (open) form.reset(); onOpenChange(false) }}
      title="New contact"
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)} disabled={form.isPending}>Cancel</Button>
          <Button onClick={form.submit} disabled={form.isPending || !form.canSubmit}>
            {form.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
            {form.isPending ? 'Saving' : 'New contact'}
          </Button>
        </>
      }
    >
      <AddPersonFields form={form} />
    </Dialog>
  )
}

/** Always-visible add form for /admin/people. The primary path. */
export function AddPersonCard() {
  const form = useAddPersonForm(() => undefined)

  return (
    <section
      id="add-person"
      data-tour="crm-add-person"
      aria-label="New contact"
      style={{
        border: '1px solid var(--a-border)',
        borderRadius: 'var(--a-r-lg)',
        background: 'var(--a-surface)',
        padding: 16,
        marginBottom: 20,
      }}
    >
      <SectionHead flush>New contact</SectionHead>
      {form.created ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-ok)', fontWeight: 500, margin: '8px 0 0' }}>
          Opening {form.created.name}. Stage, tags, related people, and notes are on that page.
        </p>
      ) : (
        <>
          <AddPersonFields form={form} />
          <div style={{ marginTop: 12 }}>
            <Button onClick={form.submit} disabled={form.isPending || !form.canSubmit} touch>
              {form.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              {form.isPending ? 'Saving' : 'New contact'}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

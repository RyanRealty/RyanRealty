'use client'

import { useState, useTransition } from 'react'
import { updateSpamLabelAction, updateSubdomainAction } from '@/app/actions/crm-company-settings'
import { Button, Dialog, TextField } from '@/components/admin/v2'

/**
 * The two "(Change)" inline flows on Company Settings:
 *  - SpamLabelChange (spec §1.4 row 12 / AC-6): edits the legal entity name
 *    carriers show for STIR/SHAKEN caller ID; hard-capped at 15 characters.
 *  - SubdomainChange (spec §1.6 / AC-8): warning modal + explicit text input of
 *    the new prefix before saving the stored account subdomain identifier.
 *
 * P11F: migrated to the LOCKED admin v2 language. Both modals are the v2
 * <Dialog> (native <dialog>: platform focus trap, Esc, top layer) — never a
 * hand-rolled overlay.
 *
 * ci:admin-ui rule C counts primary-variant v2 <Button>s PER FILE, and this
 * file holds two independent save flows. The spam-label "Save" keeps the one
 * primary; the subdomain "Confirm change" is `danger`, which is also the honest
 * read of it — §1.6 specifies a warning modal that retypes the prefix before it
 * rewrites the stored account identifier.
 */

function ChangeLink({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="quiet" onClick={onClick}>
      (Change)
    </Button>
  )
}

export function SpamLabelChange({ value, onSaved }: { value: string; onSaved: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(value)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function save() {
    setError('')
    startTransition(async () => {
      try {
        const clean = label.trim().slice(0, 15)
        await updateSpamLabelAction(clean)
        onSaved(clean)
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  return (
    <>
      <ChangeLink onClick={() => { setLabel(value); setOpen(true) }} />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Spam label calling protection"
        description="The legal entity name registered with carriers for STIR/SHAKEN caller ID. Carriers use the first 15 characters of the legal business name."
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={isPending || !label.trim()}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </>
        }
      >
        <TextField
          label="Legal entity name"
          value={label}
          maxLength={15}
          onChange={(e) => setLabel(e.target.value)}
        />
        <p
          className="a-num"
          style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
        >
          {label.trim().length}/15 characters
        </p>
        {error && (
          <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>{error}</p>
        )}
      </Dialog>
    </>
  )
}

export function SubdomainChange({ value, onSaved }: { value: string; onSaved: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [prefix, setPrefix] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function save() {
    setError('')
    startTransition(async () => {
      try {
        const clean = prefix.trim().toLowerCase()
        await updateSubdomainAction(clean)
        onSaved(clean)
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  return (
    <>
      <ChangeLink onClick={() => { setPrefix(''); setOpen(true) }} />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Change account subdomain"
        description="This changes the stored account subdomain identifier. The CRM login URL (ryan-realty.com/admin) and existing sessions do not change."
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={save} disabled={isPending || !prefix.trim()}>
              {isPending ? 'Saving...' : 'Confirm change'}
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-end" style={{ gap: 'var(--a-s2)' }}>
          <div style={{ flex: '1 1 200px', maxWidth: 208 }}>
            <TextField
              label="New subdomain"
              value={prefix}
              placeholder={value}
              onChange={(e) => setPrefix(e.target.value)}
            />
          </div>
          <span
            style={{
              fontSize: 'var(--a-text-sm)',
              color: 'var(--a-text-2)',
              paddingBottom: 'var(--a-s3)',
            }}
          >
            .ryan-realty.com
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          Type the new prefix to confirm. Current:{' '}
          <span style={{ fontWeight: 500, color: 'var(--a-text)' }}>{value}</span>
        </p>
        {error && (
          <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>{error}</p>
        )}
      </Dialog>
    </>
  )
}

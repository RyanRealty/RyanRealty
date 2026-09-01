'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button, Dialog, SelectField, TextField } from '@/components/admin/v2'
import { createFileFromClosingsAction } from '@/app/actions/tc-deal-people'

/** Compact opener — the new-file form lives in a dialog, not on the board. */
export function NewFileForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  const submit = (fd: FormData) => {
    start(async () => {
      const res = await createFileFromClosingsAction(fd)
      if (res.error) {
        toast.error(res.error)
        return
      }
      if (res.propertyKey) {
        toast.success('File opened.')
        setOpen(false)
        router.push(`/admin/deals/${encodeURIComponent(res.propertyKey)}`)
      }
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} touch>
        New file
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New file">
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 12px' }}>
          Seller opens a listing. Buyer opens an accepted offer. Vault is the file.
        </p>
        <form
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault()
            submit(new FormData(e.currentTarget))
          }}
        >
          <SelectField label="Representation" name="representation" defaultValue="seller">
            <option value="seller">Seller (listing)</option>
            <option value="buyer">Buyer (sale)</option>
          </SelectField>
          <TextField label="Property address" name="address" required placeholder="123 NW Bond St, Bend" />
          <TextField label="Client name" name="clientName" required placeholder="Mary Bowman" />
          <TextField label="Client email" name="clientEmail" type="email" required placeholder="name@email.com" />
          <TextField label="MLS number" name="mlsNumber" placeholder="Optional" />
          <Button type="submit" disabled={pending} touch>
            {pending ? 'Opening…' : 'Open file'}
          </Button>
        </form>
      </Dialog>
    </>
  )
}

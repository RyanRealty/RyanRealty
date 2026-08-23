'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button, SectionHead, SelectField, TextField } from '@/components/admin/v2'
import { createFileFromClosingsAction } from '@/app/actions/tc-deal-people'

export function NewFileForm() {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <section aria-label="New file" style={{ margin: '0 0 20px' }}>
      <SectionHead>New file</SectionHead>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 12px' }}>
        Seller opens a listing. Buyer opens an accepted offer. Vault is the file.
      </p>
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          start(async () => {
            const res = await createFileFromClosingsAction(fd)
            if (res.error) {
              toast.error(res.error)
              return
            }
            if (res.propertyKey) {
              toast.success('File opened.')
              router.push(`/admin/deals/${encodeURIComponent(res.propertyKey)}`)
            }
          })
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
    </section>
  )
}

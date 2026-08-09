'use client'

/**
 * Manual "Build CMA" form — address or MLS lookup + client + broker, then the
 * deterministic builder runs and the browser lands on the review page.
 *
 * 11F: on the LOCKED admin v2 language (mirrors the BPO family's
 * BuildBpoForm.tsx). Label+Input+Select -> TextField/SelectField, pattern 6
 * (single column, label-above), same field names and same submit logic.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, SelectField, TextField } from '@/components/admin/v2'
import { buildCmaAdminAction } from '@/app/actions/cma-admin'

export interface BrokerOption {
  slug: string
  displayName: string
}

export function BuildCmaForm({ brokers }: { brokers: BrokerOption[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [address, setAddress] = useState('')
  const [mlsNumber, setMlsNumber] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [brokerSlug, setBrokerSlug] = useState(brokers[0]?.slug ?? 'matthew-ryan')

  function submit() {
    if (!address.trim() && !mlsNumber.trim()) {
      toast.error('Enter a property address or an MLS number.')
      return
    }
    startTransition(async () => {
      const { data, error } = await buildCmaAdminAction({
        address: address.trim() || null,
        mlsNumber: mlsNumber.trim() || null,
        clientName: clientName.trim() || null,
        clientEmail: clientEmail.trim() || null,
        clientPhone: clientPhone.trim() || null,
        brokerSlug,
      })
      if (error || !data) {
        toast.error(error ?? 'Build failed')
        return
      }
      toast.success('CMA built. Review it before sending.')
      router.push(`/admin/cmas/${data.slug}`)
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Property address"
          placeholder="16111 Lava Dr, La Pine, OR 97739"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          hint="Street number, street, city. The subject resolves from the MLS record."
        />
        <TextField
          label="Or MLS number"
          placeholder="220213342"
          value={mlsNumber}
          onChange={(e) => setMlsNumber(e.target.value)}
          hint="Used when provided. Address is optional in that case."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <TextField label="Client name" placeholder="Jane Homeowner" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        <TextField
          label="Client email"
          type="email"
          placeholder="jane@example.com"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
        />
        <TextField label="Client phone" placeholder="541.555.0100" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SelectField label="Signing broker" value={brokerSlug} onChange={(e) => setBrokerSlug(e.target.value)}>
          {brokers.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.displayName}
            </option>
          ))}
        </SelectField>
      </div>

      <Button onClick={submit} disabled={isPending} touch>
        {isPending ? 'Building (30 to 60 seconds)…' : 'Build CMA'}
      </Button>
    </div>
  )
}

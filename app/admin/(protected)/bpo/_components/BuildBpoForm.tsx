'use client'

/**
 * Manual "Build Broker Price Opinion" form — address or MLS lookup, signing
 * broker, and an optional purpose label. The deterministic builder runs on
 * submit and the browser lands on the review page.
 *
 * 11F: on the LOCKED admin v2 language (this island's page,
 * /admin/bpo/new/page.tsx, already migrated — this brings the mounted form to
 * match). Label+Input+Select -> TextField/SelectField, pattern 6 (single
 * column, label-above), same field names and same submit logic.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, SelectField, TextField } from '@/components/admin/v2'
import { buildBpoAdminAction } from '@/app/actions/bpo-admin'

export interface BrokerOption {
  slug: string
  displayName: string
}

const PURPOSES = [
  'pre-listing',
  'listing appointment',
  'internal review',
  'lender / relocation',
  'seller check-in',
]

export function BuildBpoForm({ brokers }: { brokers: BrokerOption[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [address, setAddress] = useState('')
  const [mlsNumber, setMlsNumber] = useState('')
  const [purpose, setPurpose] = useState(PURPOSES[0]!)
  const [brokerSlug, setBrokerSlug] = useState(brokers[0]?.slug ?? 'matthew-ryan')

  function submit() {
    if (!address.trim() && !mlsNumber.trim()) {
      toast.error('Enter a property address or an MLS number.')
      return
    }
    startTransition(async () => {
      const { data, error } = await buildBpoAdminAction({
        address: address.trim() || null,
        mlsNumber: mlsNumber.trim() || null,
        brokerSlug,
        purpose,
      })
      if (error || !data) {
        toast.error(error ?? 'Build failed')
        return
      }
      toast.success('Broker price opinion built. Review it below.')
      router.push(`/admin/bpo/${data.slug}`)
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Property address"
          placeholder="3124 NW Lynch Ave, Redmond, OR 97756"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          hint="Street number, street, city. The subject resolves from the MLS record, including its full listing history."
        />
        <TextField
          label="Or MLS number"
          placeholder="220219617"
          value={mlsNumber}
          onChange={(e) => setMlsNumber(e.target.value)}
          hint="Used when provided. Address is optional in that case."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SelectField label="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
          {PURPOSES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </SelectField>
        <SelectField label="Signing broker" value={brokerSlug} onChange={(e) => setBrokerSlug(e.target.value)}>
          {brokers.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.displayName}
            </option>
          ))}
        </SelectField>
      </div>

      <Button onClick={submit} disabled={isPending} touch>
        {isPending ? 'Building (15 to 40 seconds)…' : 'Build broker price opinion'}
      </Button>
    </div>
  )
}

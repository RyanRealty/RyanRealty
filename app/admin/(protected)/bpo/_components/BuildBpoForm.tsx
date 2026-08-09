'use client'

/**
 * Manual "Build Broker Price Opinion" form — address or MLS lookup, signing
 * broker, and an optional purpose label. The deterministic builder runs on
 * submit and the browser lands on the review page.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
        <div className="space-y-1.5">
          <Label htmlFor="bpo-address">Property address</Label>
          <Input
            id="bpo-address"
            placeholder="3124 NW Lynch Ave, Redmond, OR 97756"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Street number, street, city. The subject resolves from the MLS record, including its full listing history.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bpo-mls">Or MLS number</Label>
          <Input
            id="bpo-mls"
            placeholder="220219617"
            value={mlsNumber}
            onChange={(e) => setMlsNumber(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Used when provided. Address is optional in that case.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bpo-purpose">Purpose</Label>
          <Select value={purpose} onValueChange={setPurpose}>
            <SelectTrigger id="bpo-purpose" className="w-full">
              <SelectValue placeholder="Select a purpose" />
            </SelectTrigger>
            <SelectContent>
              {PURPOSES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bpo-broker">Signing broker</Label>
          <Select value={brokerSlug} onValueChange={setBrokerSlug}>
            <SelectTrigger id="bpo-broker" className="w-full">
              <SelectValue placeholder="Select a broker" />
            </SelectTrigger>
            <SelectContent>
              {brokers.map((b) => (
                <SelectItem key={b.slug} value={b.slug}>
                  {b.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={submit} disabled={isPending} className="min-h-11">
        {isPending ? 'Building (15 to 40 seconds)…' : 'Build broker price opinion'}
      </Button>
    </div>
  )
}

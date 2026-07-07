'use client'

/**
 * Manual "Build CMA" form — address or MLS lookup + client + broker, then the
 * deterministic builder runs and the browser lands on the review page.
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
        <div className="space-y-1.5">
          <Label htmlFor="cma-address">Property address</Label>
          <Input
            id="cma-address"
            placeholder="16111 Lava Dr, La Pine, OR 97739"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Street number, street, city. The subject resolves from the MLS record.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cma-mls">Or MLS number</Label>
          <Input
            id="cma-mls"
            placeholder="220213342"
            value={mlsNumber}
            onChange={(e) => setMlsNumber(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Used when provided. Address is optional in that case.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cma-client-name">Client name</Label>
          <Input
            id="cma-client-name"
            placeholder="Jane Homeowner"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cma-client-email">Client email</Label>
          <Input
            id="cma-client-email"
            type="email"
            placeholder="jane@example.com"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cma-client-phone">Client phone</Label>
          <Input
            id="cma-client-phone"
            placeholder="541.555.0100"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cma-broker">Signing broker</Label>
          <Select value={brokerSlug} onValueChange={setBrokerSlug}>
            <SelectTrigger id="cma-broker" className="w-full">
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
        {isPending ? 'Building (30 to 60 seconds)…' : 'Build CMA'}
      </Button>
    </div>
  )
}

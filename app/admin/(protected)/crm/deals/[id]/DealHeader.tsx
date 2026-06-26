'use client'

import { useTransition, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { updateCrmDeal } from '@/app/actions/crm-deals'

type Props = {
  dealId: number
  initialName: string | null
  initialAddress: string | null
  initialValue: number | null
  initialCloseDate: string | null
  initialDescription: string | null
  stage: string | null
  pipeline: string | null
}

export function DealHeader({
  dealId,
  initialName,
  initialAddress,
  initialValue,
  initialCloseDate,
  initialDescription,
  stage,
  pipeline,
}: Props) {
  const [name, setName] = useState(initialName ?? '')
  const [address, setAddress] = useState(initialAddress ?? '')
  const [value, setValue] = useState(initialValue != null ? String(initialValue) : '')
  const [closeDate, setCloseDate] = useState(initialCloseDate ?? '')
  const [description, setDescription] = useState(initialDescription ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save(patch: Parameters<typeof updateCrmDeal>[1]) {
    setError(null)
    startTransition(async () => {
      const res = await updateCrmDeal(dealId, patch)
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <div className="space-y-4">
      {/* pipeline breadcrumb + stage badge */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {pipeline ? <span className="font-medium text-foreground">{pipeline}</span> : null}
        {pipeline && stage ? <span>›</span> : null}
        {stage ? (
          <Badge variant="secondary">{stage}</Badge>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="deal-name" className="text-xs text-muted-foreground">
            Deal name
          </Label>
          <Input
            id="deal-name"
            value={name}
            disabled={isPending}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => save({ name: name || null })}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="deal-address" className="text-xs text-muted-foreground">
            Property address
          </Label>
          <Input
            id="deal-address"
            value={address}
            disabled={isPending}
            onChange={(e) => setAddress(e.target.value)}
            onBlur={() => save({ property_address: address || null })}
            placeholder="123 Main St, Bend OR"
            className="h-8 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="deal-value" className="text-xs text-muted-foreground">
            Price ($)
          </Label>
          <Input
            id="deal-value"
            type="number"
            min="0"
            step="1000"
            value={value}
            disabled={isPending}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => save({ value: value ? Number(value) : null })}
            placeholder="e.g. 650000"
            className="h-8 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="deal-close" className="text-xs text-muted-foreground">
            Close date
          </Label>
          <Input
            id="deal-close"
            type="date"
            value={closeDate}
            disabled={isPending}
            onChange={(e) => setCloseDate(e.target.value)}
            onBlur={() => save({ close_date: closeDate || null })}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="deal-desc" className="text-xs text-muted-foreground">
          Description
        </Label>
        <Textarea
          id="deal-desc"
          rows={3}
          value={description}
          disabled={isPending}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => save({ description: description || null })}
          placeholder="Notes about this deal..."
          className="text-sm"
        />
      </div>
    </div>
  )
}

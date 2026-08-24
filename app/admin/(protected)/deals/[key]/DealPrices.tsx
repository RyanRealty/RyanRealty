'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button, TextField } from '@/components/admin/v2'
import { saveCyclePrices } from '@/app/actions/tc-cycle-prices'

export function DealPrices({
  cycleId,
  propertyKey,
  listingPrice,
  salePrice,
}: {
  cycleId: string
  propertyKey: string
  listingPrice: number | null
  salePrice: number | null
}) {
  const [pending, start] = useTransition()
  const [list, setList] = useState(listingPrice == null ? '' : String(listingPrice))
  const [sale, setSale] = useState(salePrice == null ? '' : String(salePrice))
  return (
    <form
      style={{ display: 'grid', gap: 8, margin: '8px 0 16px' }}
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const res = await saveCyclePrices({
            cycleId,
            propertyKey,
            listingPrice: list,
            salePrice: sale,
          })
          if (res.error) toast.error(res.error)
          else toast.success('Prices saved.')
        })
      }}
    >
      <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        List price is required on the listing agreement. Sale price is required on the sale agreement.
        Leave blank if the file does not state one yet.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
        <TextField
          label="List price"
          value={list}
          onChange={(e) => setList(e.target.value)}
          inputMode="decimal"
        />
        <TextField
          label="Sale price"
          value={sale}
          onChange={(e) => setSale(e.target.value)}
          inputMode="decimal"
        />
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}

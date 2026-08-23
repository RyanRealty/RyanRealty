'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, ReportGrid, SelectField, TextField } from '@/components/admin/v2'
import { acceptDealOffer, saveDealOffer } from '@/app/actions/tc-offers'
import {
  FINANCING_LABEL,
  FINANCING_TYPES,
  OFFER_COMPARE_ROWS,
  OFFER_STATUS_LABEL,
  OFFER_STATUSES,
  offerCompareValue,
  type DealOffer,
  type OfferStatus,
} from '@/lib/tc/offers'

export function DealOffers({
  dealId,
  stage,
  offers,
}: {
  dealId: string
  stage: string
  offers: DealOffer[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const canOffer = stage === 'active_listing' || stage === 'pending' || stage === 'pre_contract'
  if (!canOffer && offers.length === 0) return null

  const columns = [
    { key: 'term', label: 'Term' },
    ...offers.map((o, i) => ({ key: o.id, label: offers.length === 1 ? o.buyerName : `Offer ${i + 1}` })),
  ]
  const rows = OFFER_COMPARE_ROWS.map((row) => ({
    key: row.key,
    cells: [
      row.label,
      ...offers.map((o) => offerCompareValue(o, row.key)),
    ],
  }))

  return (
    <div className="av2-pane">
      <div className="flex items-center justify-between gap-3">
        <p style={{ margin: 0, fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>
          Offers
        </p>
        {canOffer ? (
          <Button variant="quiet" onClick={() => setOpen((v) => !v)}>
            {open ? 'Cancel' : 'Add offer'}
          </Button>
        ) : null}
      </div>
      {offers.length === 0 && !open ? (
        <p style={{ margin: 0, fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
          No offers on this file yet. Add one to compare price, earnest, financing, and close.
        </p>
      ) : null}
      {offers.length > 0 ? (
        <>
          <ReportGrid
            label="Offer comparison"
            columns={columns}
            template={`minmax(120px, 0.8fr) ${offers.map(() => 'minmax(140px, 1fr)').join(' ')}`}
            minWidth={220 + offers.length * 160}
            rows={rows}
          />
          {stage === 'active_listing' || stage === 'pending' ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {offers.map((o) =>
                o.status === 'accepted' ? null : (
                  <Button
                    key={o.id}
                    variant="quiet"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`Accept ${o.buyerName}'s offer? Other offers are marked rejected.`)) return
                      start(async () => {
                        const res = await acceptDealOffer(dealId, o.id)
                        if (res.error) toast.error(res.error)
                        else {
                          toast.success('Offer accepted.')
                          router.refresh()
                        }
                      })
                    }}
                  >
                    Accept {o.buyerName}
                  </Button>
                ),
              )}
            </div>
          ) : null}
        </>
      ) : null}
      {open ? (
        <OfferForm
          dealId={dealId}
          onDone={() => {
            setOpen(false)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function OfferForm({ dealId, onDone }: { dealId: string; onDone: () => void }) {
  const [pending, start] = useTransition()
  const [buyerName, setBuyerName] = useState('')
  const [buyerAgent, setBuyerAgent] = useState('')
  const [price, setPrice] = useState('')
  const [earnest, setEarnest] = useState('')
  const [financing, setFinancing] = useState('conventional')
  const [closeDate, setCloseDate] = useState('')
  const [contingencies, setContingencies] = useState('')
  const [status, setStatus] = useState<OfferStatus>('received')

  return (
    <form
      style={{ display: 'grid', gap: 10, marginTop: 12 }}
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const res = await saveDealOffer({
            dealId,
            buyerName,
            buyerAgent,
            price: price ? Number(price) : null,
            earnestMoney: earnest ? Number(earnest) : null,
            financingType: financing,
            closeDate: closeDate || null,
            contingencies,
            status,
          })
          if (res.error) toast.error(res.error)
          else {
            toast.success('Offer saved.')
            onDone()
          }
        })
      }}
    >
      <TextField label="Buyer" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required />
      <TextField label="Buyer agent" value={buyerAgent} onChange={(e) => setBuyerAgent(e.target.value)} />
      <TextField label="Price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
      <TextField label="Earnest money" type="number" value={earnest} onChange={(e) => setEarnest(e.target.value)} />
      <SelectField label="Financing" value={financing} onChange={(e) => setFinancing(e.target.value)}>
        {FINANCING_TYPES.map((t) => (
          <option key={t} value={t}>
            {FINANCING_LABEL[t]}
          </option>
        ))}
      </SelectField>
      <TextField label="Close date" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
      <TextField
        label="Contingencies"
        value={contingencies}
        onChange={(e) => setContingencies(e.target.value)}
      />
      <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value as OfferStatus)}>
        {OFFER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {OFFER_STATUS_LABEL[s]}
          </option>
        ))}
      </SelectField>
      <Button type="submit" disabled={pending || !buyerName.trim()}>
        Save offer
      </Button>
    </form>
  )
}

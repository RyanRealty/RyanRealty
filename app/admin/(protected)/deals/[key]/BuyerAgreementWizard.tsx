'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button, SelectField, TextAreaField, TextField } from '@/components/admin/v2'
import { saveBuyerAgreementDraft } from '@/app/actions/tc-buyer-agreement'

/** OAR 863-015-0133 eight required contents. */
export function BuyerAgreementWizard({ cycleId, propertyKey }: { cycleId: string; propertyKey: string }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [license, setLicense] = useState('')
  const [pb, setPb] = useState('Matthew Ryan · 541-728-2280 · matt@ryan-realty.com')
  const [termStart, setTermStart] = useState('')
  const [termEnd, setTermEnd] = useState('')
  const [duties, setDuties] = useState('Represent the buyer in locating and negotiating a 1–4 unit residential purchase in Central Oregon.')
  const [criteria, setCriteria] = useState('')
  const [priceRange, setPriceRange] = useState('')
  const [compensation, setCompensation] = useState('Seller-paid cooperative compensation as offered; buyer not obligated to pay brokerage compensation unless agreed in writing.')
  const [termination, setTermination] = useState('Either party may terminate in writing as provided in the agreement.')
  const [exclusive, setExclusive] = useState('exclusive')

  if (!open) {
    return (
      <Button variant="quiet" onClick={() => setOpen(true)}>
        Buyer agreement (OAR 863-015-0133)
      </Button>
    )
  }

  return (
    <form
      style={{ display: 'grid', gap: 8, margin: '12px 0', maxWidth: 560 }}
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const res = await saveBuyerAgreementDraft({
            cycleId,
            propertyKey,
            license,
            supervisingPb: pb,
            termStart,
            termEnd,
            duties,
            searchCriteria: criteria,
            priceRange,
            compensation,
            termination,
            exclusive: exclusive === 'exclusive',
          })
          if (res.error) toast.error(res.error)
          else toast.success(res.envelopeId ? 'Draft saved and envelope opened.' : 'Draft saved on the file.')
        })
      }}
    >
      <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        Eight contents Oregon requires in a written buyer representation agreement. Term cannot exceed 24 months.
      </p>
      <TextField label="License number" value={license} onChange={(e) => setLicense(e.target.value)} required />
      <TextField label="Supervising principal broker" value={pb} onChange={(e) => setPb(e.target.value)} required />
      <TextField label="Term start" type="date" value={termStart} onChange={(e) => setTermStart(e.target.value)} required />
      <TextField label="Term end (max 24 months)" type="date" value={termEnd} onChange={(e) => setTermEnd(e.target.value)} required />
      <TextAreaField label="Buyer-agent duties" value={duties} onChange={(e) => setDuties(e.target.value)} />
      <TextField label="Search criteria" value={criteria} onChange={(e) => setCriteria(e.target.value)} />
      <TextField label="Price range" value={priceRange} onChange={(e) => setPriceRange(e.target.value)} />
      <TextAreaField label="Compensation" value={compensation} onChange={(e) => setCompensation(e.target.value)} />
      <TextAreaField label="Termination" value={termination} onChange={(e) => setTermination(e.target.value)} />
      <SelectField label="Exclusive vs non-exclusive" value={exclusive} onChange={(e) => setExclusive(e.target.value)}>
        <option value="exclusive">Exclusive (OREF 050)</option>
        <option value="nonexclusive">Non-exclusive (OREF 052)</option>
      </SelectField>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="submit" disabled={pending}>
          Save on file
        </Button>
        <Button variant="quiet" type="button" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

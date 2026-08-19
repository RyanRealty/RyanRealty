'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveAddressRowAction } from '@/app/actions/crm-person-detail'
import { formatPersonAddress, type PersonAddress } from '@/lib/crm/person-address'
import { Button, TextField } from '@/components/admin/v2'

export function PersonAddressEditor({
  personId,
  address,
}: {
  personId: number
  address: PersonAddress | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [street, setStreet] = useState(address?.street ?? '')
  const [city, setCity] = useState(address?.city ?? '')
  const [state, setState] = useState(address?.state || 'OR')
  const [zip, setZip] = useState(address?.zip ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const line = address ? formatPersonAddress(address) : null

  if (!editing) {
    return (
      <div style={{ margin: '0 0 14px', fontSize: 'var(--a-text-sm)' }}>
        {line ? (
          <div style={{ fontFamily: 'var(--a-font-mono)' }}>{line}</div>
        ) : (
          <span style={{ color: 'var(--a-text-2)' }}>No address on file</span>
        )}
        <div style={{ marginTop: 6 }}>
          <Button
            variant="quiet"
            onClick={() => {
              setStreet(address?.street ?? '')
              setCity(address?.city ?? '')
              setState(address?.state || 'OR')
              setZip(address?.zip ?? '')
              setError(null)
              setEditing(true)
            }}
          >
            {line ? 'Edit address' : 'Add address'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <TextField label="Street" name="street" value={street} onChange={(e) => setStreet(e.target.value)} autoComplete="off" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 88px', gap: 10 }}>
        <TextField label="City" name="city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="off" />
        <TextField label="State" name="state" value={state} onChange={(e) => setState(e.target.value)} autoComplete="off" />
        <TextField label="Zip" name="zip" value={zip} onChange={(e) => setZip(e.target.value)} autoComplete="off" />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveAddressRowAction(personId, { street, city, state, zip })
              if (r.ok) {
                setEditing(false)
                router.refresh()
              } else {
                setError(r.error ?? 'Could not save address')
              }
            })
          }
        >
          Save address
        </Button>
        <Button variant="quiet" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {error ? (
        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }} role="alert">{error}</p>
      ) : null}
    </div>
  )
}

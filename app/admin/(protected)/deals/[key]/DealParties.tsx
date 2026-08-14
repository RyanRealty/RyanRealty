'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button, Combobox, SelectField } from '@/components/admin/v2'
import {
  addPersonToDealAction,
  removePersonFromDealAction,
  searchPeopleForDealAction,
} from '@/app/actions/tc-deal-people'
import { DEAL_PERSON_ROLE_LABEL, type DealPersonRole } from '@/lib/tc/deal-people'

type DealParty = {
  id: string
  dealId: string
  personId: number
  role: DealPersonRole
  name: string | null
}

export function DealParties({
  dealId,
  propertyKey,
  parties,
}: {
  dealId: string
  propertyKey: string
  parties: DealParty[]
}) {
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Array<{ id: number; name: string | null; email: string | null }>>([])
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [role, setRole] = useState<DealPersonRole>('buyer')

  const options = useMemo(
    () =>
      hits
        .filter((h) => !parties.some((p) => p.personId === h.id))
        .map((h) => ({
          value: String(h.id),
          label: h.name?.trim() || `Person ${h.id}`,
          hint: h.email ?? undefined,
        })),
    [hits, parties],
  )

  function onQueryChange(next: string) {
    setQuery(next)
    if (next.trim().length < 2) {
      setHits([])
      return
    }
    setLoading(true)
    startTransition(async () => {
      const res = await searchPeopleForDealAction(next)
      setLoading(false)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setHits(res.data)
    })
  }

  function add() {
    if (!picked) return
    const fd = new FormData()
    fd.set('dealId', dealId)
    fd.set('propertyKey', propertyKey)
    fd.set('personId', picked)
    fd.set('role', role)
    startTransition(async () => {
      const { error } = await addPersonToDealAction(fd)
      if (error) toast.error(error)
      else toast.success('Added to the deal.')
    })
  }

  function remove(p: DealParty) {
    const fd = new FormData()
    fd.set('dealId', dealId)
    fd.set('propertyKey', propertyKey)
    fd.set('linkId', p.id)
    fd.set('personId', String(p.personId))
    startTransition(async () => {
      const { error } = await removePersonFromDealAction(fd)
      if (error) toast.error(error)
    })
  }

  return (
    <section aria-label="People on this deal" className="av2-pane" style={{ marginTop: 16 }}>
      <p style={{ margin: '0 0 8px', fontSize: 'var(--a-text-md)', fontWeight: 500 }}>
        People on this deal
      </p>
      {parties.length === 0 ? (
        <p style={{ margin: '0 0 12px', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          No CRM people linked yet. A transaction has more than one.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0 }}>
          {parties.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 py-2"
              style={{ borderTop: i ? '1px solid var(--a-border)' : undefined }}
            >
              <div>
                <Link href={`/admin/people/${p.personId}`} style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
                  {p.name ?? `Person ${p.personId}`}
                </Link>
                <span className="av2-chip ml-2" style={{ cursor: 'default' }}>
                  {DEAL_PERSON_ROLE_LABEL[p.role]}
                </span>
              </div>
              <Button variant="quiet" disabled={pending} onClick={() => remove(p)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 220px' }}>
          <Combobox
            label="Add a person"
            options={options}
            value={picked}
            onSelect={setPicked}
            onQueryChange={onQueryChange}
            loading={loading}
            idleText={query.trim().length < 2 ? 'Type a name.' : undefined}
            placeholder="Search people"
          />
        </div>
        <SelectField
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as DealPersonRole)}
        >
          <option value="buyer">{DEAL_PERSON_ROLE_LABEL.buyer}</option>
          <option value="seller">{DEAL_PERSON_ROLE_LABEL.seller}</option>
          <option value="other">{DEAL_PERSON_ROLE_LABEL.other}</option>
        </SelectField>
        <Button disabled={pending || !picked} onClick={add}>
          Add
        </Button>
      </div>
    </section>
  )
}

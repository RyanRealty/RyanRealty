'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button, SelectField, TextAreaField, TextField } from '@/components/admin/v2'
import { saveClause, saveFormPacket, type ClauseRow, type FormPacket } from '@/app/actions/tc-library'
import { createEnvelopeFromTemplate } from '@/app/actions/tc-envelopes'
import { useRouter } from 'next/navigation'
import type { LiveDealCycle } from '@/lib/data/tc/closings'

export function FormsLibraryExtras({
  packets,
  clauses,
  deals,
  formIds,
}: {
  packets: FormPacket[]
  clauses: ClauseRow[]
  deals: LiveDealCycle[]
  formIds: Array<{ id: string; label: string }>
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [packetName, setPacketName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [clauseTitle, setClauseTitle] = useState('')
  const [clauseBody, setClauseBody] = useState('')
  const [packetDeal, setPacketDeal] = useState(deals[0]?.cycleId ?? '')

  return (
    <div className="av2-rcols" style={{ display: 'grid', gap: 24, marginTop: 28 }}>
      <section>
        <h2 className="av2-lane-head">Packets</h2>
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Saved sets of library forms. Instantiate onto an in-flight deal as a draft envelope.
        </p>
        {packets.length ? (
          <ul className="av2-quietlist">
            {packets.map((p) => (
              <li key={p.id} className="av2-quiet">
                <span className="av2-quiet__name">{p.name}</span>
                <span className="av2-quiet__fig">{p.formVersionIds.length} forms</span>
                <Button
                  variant="quiet"
                  disabled={pending || !packetDeal || !p.formVersionIds.length}
                  onClick={() => {
                    start(async () => {
                      const res = await createEnvelopeFromTemplate(packetDeal, p.formVersionIds, p.name)
                      if (!res.ok || !res.envelopeId) toast.error(res.error ?? 'Could not create')
                      else router.push(`/admin/signing/${res.envelopeId}`)
                    })
                  }}
                >
                  Use on deal
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>No packets yet.</p>
        )}
        <form
          style={{ display: 'grid', gap: 8, marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const res = await saveFormPacket(packetName, picked)
              if (res.error) toast.error(res.error)
              else {
                toast.success('Packet saved.')
                setPacketName('')
                router.refresh()
              }
            })
          }}
        >
          <TextField label="Packet name" value={packetName} onChange={(e) => setPacketName(e.target.value)} />
          <SelectField label="Deal for Use on deal" value={packetDeal} onChange={(e) => setPacketDeal(e.target.value)}>
            {deals.map((d) => (
              <option key={d.cycleId} value={d.cycleId}>
                {d.address}
              </option>
            ))}
          </SelectField>
          <label className="av2-field__label">Forms in packet</label>
          <div style={{ maxHeight: 160, overflow: 'auto', display: 'grid', gap: 4 }}>
            {formIds.slice(0, 40).map((f) => (
              <label key={f.id} style={{ fontSize: 'var(--a-text-sm)' }}>
                <input
                  type="checkbox"
                  checked={picked.includes(f.id)}
                  onChange={() =>
                    setPicked((cur) => (cur.includes(f.id) ? cur.filter((x) => x !== f.id) : [...cur, f.id]))
                  }
                />{' '}
                {f.label}
              </label>
            ))}
          </div>
          <Button type="submit" disabled={pending || !packetName.trim() || !picked.length}>
            Save packet
          </Button>
        </form>
      </section>

      <section>
        <h2 className="av2-lane-head">Clauses</h2>
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Reusable text. Copy into a compose text field.
        </p>
        {clauses.length ? (
          <ul className="av2-quietlist">
            {clauses.map((c) => (
              <li key={c.id} className="av2-quiet">
                <span className="av2-quiet__name">{c.title}</span>
                <Button
                  variant="quiet"
                  onClick={() => {
                    void navigator.clipboard.writeText(c.body)
                    toast.success('Copied clause.')
                  }}
                >
                  Copy
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>No clauses yet.</p>
        )}
        <form
          style={{ display: 'grid', gap: 8, marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const res = await saveClause({
                scope: 'brokerage',
                category: 'General',
                title: clauseTitle,
                body: clauseBody,
              })
              if (res.error) toast.error(res.error)
              else {
                toast.success('Clause saved.')
                setClauseTitle('')
                setClauseBody('')
                router.refresh()
              }
            })
          }}
        >
          <TextField label="Clause title" value={clauseTitle} onChange={(e) => setClauseTitle(e.target.value)} />
          <TextAreaField label="Body" value={clauseBody} onChange={(e) => setClauseBody(e.target.value)} />
          <Button type="submit" disabled={pending || !clauseTitle.trim() || !clauseBody.trim()}>
            Save clause
          </Button>
        </form>
      </section>
    </div>
  )
}

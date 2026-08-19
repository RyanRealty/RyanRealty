'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  linkExistingRelationshipAction,
  searchPeopleForLinkAction,
  type RelationshipSearchHit,
} from '@/app/actions/crm-relationships'
import {
  RELATIONSHIP_LABELS,
  SIMPLE_RELATIONSHIP_TYPES,
} from '@/lib/crm/relationships'
import type { ContactRelationship } from '@/lib/data/crm/getContactRelationships'
import { Button, SectionHead, TextField } from '@/components/admin/v2'

export function PersonRelationships({
  personId,
  relationships,
}: {
  personId: number
  relationships: ContactRelationship[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<RelationshipSearchHit[]>([])
  const [type, setType] = useState<(typeof SIMPLE_RELATIONSHIP_TYPES)[number]>('spouse')
  const [error, setError] = useState<string | null>(null)
  const [searching, startSearch] = useTransition()
  const [saving, startSave] = useTransition()

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setHits([])
      return
    }
    const handle = setTimeout(() => {
      startSearch(async () => {
        setHits(await searchPeopleForLinkAction(term, personId))
      })
    }, 200)
    return () => clearTimeout(handle)
  }, [q, personId])

  function resetForm() {
    setQ('')
    setHits([])
    setType('spouse')
    setError(null)
  }

  function saveHit(hit: RelationshipSearchHit) {
    startSave(async () => {
      const r = await linkExistingRelationshipAction(personId, hit.id, type)
      if (!r.ok) {
        setError(r.error ?? 'Could not save the relationship')
        return
      }
      resetForm()
      router.refresh()
    })
  }

  return (
    <section aria-label="Related people" style={{ margin: '0 0 20px' }}>
      <SectionHead>Related people</SectionHead>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 8px' }}>
        Pick spouse or parent, then the person. That click saves.
      </p>
      <ul className="av2-quietlist">
        {relationships.map((r) => (
          <li key={r.id} className="av2-quiet">
            {r.relatedPersonId ? (
              <Link
                href={`/admin/people/${r.relatedPersonId}`}
                className="av2-quiet__name"
                style={{ textDecoration: 'none', color: 'var(--a-text)', minWidth: 180 }}
              >
                {r.name}
              </Link>
            ) : (
              <span className="av2-quiet__name" style={{ minWidth: 180 }}>{r.name}</span>
            )}
            <span style={{ color: 'var(--a-text-2)' }}>{r.label}</span>
          </li>
        ))}
        {relationships.length === 0 && !open ? (
          <li className="av2-quiet">
            <span style={{ color: 'var(--a-text-2)' }}>No relationships yet.</span>
          </li>
        ) : null}
      </ul>

      {!open ? (
        <Button variant="quiet" onClick={() => setOpen(true)}>
          Add
        </Button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SIMPLE_RELATIONSHIP_TYPES.map((t) => (
              <Button
                key={t}
                type="button"
                variant="quiet"
                aria-pressed={type === t}
                onClick={() => setType(t)}
              >
                {RELATIONSHIP_LABELS[t]}
              </Button>
            ))}
          </div>
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: 0 }}>
            Linking as {RELATIONSHIP_LABELS[type]}.
          </p>
          <TextField
            label="Search an existing person"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          {searching ? (
            <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>Searching.</p>
          ) : null}
          {hits.length > 0 ? (
            <ul className="av2-queue">
              {hits.map((h) => (
                <li key={h.id} className="av2-qrow">
                  <Button
                    variant="quiet"
                    className="av2-qrow__body"
                    disabled={saving}
                    onClick={() => saveHit(h)}
                  >
                    <span className="av2-qrow__title">{h.name}</span>
                    <span className="av2-qrow__ctx">{[h.phone, h.email].filter(Boolean).join(' · ')}</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <Button
            variant="quiet"
            onClick={() => {
              resetForm()
              setOpen(false)
            }}
          >
            Cancel
          </Button>
          {error ? (
            <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }} role="alert">{error}</p>
          ) : null}
        </div>
      )}
    </section>
  )
}

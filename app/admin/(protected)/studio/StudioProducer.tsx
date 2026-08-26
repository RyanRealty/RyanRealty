'use client'

/**
 * The "make something" bar. One select, one optional subject, one button.
 *
 * Producing is slow (a still, an inspection, sometimes a regeneration, then
 * six seconds of 1080p video), so the button states what is happening rather
 * than spinning silently. Nothing here posts: the result is a draft.
 */
import { useState, useTransition } from 'react'
import { Button, SelectField, TextField } from '@/components/admin/v2'
import { produceStudioDraftAction } from './actions'

export type ProducerFormat = {
  id: string
  label: string
  what: string
  subject: 'listing' | 'place' | 'none'
}

export function StudioProducer({
  formats,
  places,
}: {
  formats: ProducerFormat[]
  places: Array<{ slug: string; label: string }>
}) {
  const [formatId, setFormatId] = useState(formats[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const format = formats.find((f) => f.id === formatId) ?? formats[0]

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setNote(null)
    startTransition(async () => {
      const result = await produceStudioDraftAction({ formatId, subjectQuery: query })
      if (result.error) {
        setError(result.error)
        return
      }
      setNote('Draft is below, waiting on you. Nothing has posted.')
      setQuery('')
    })
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10, margin: '0 0 20px' }}>
      <SelectField label="Make" value={formatId} onChange={(e) => setFormatId(e.target.value)}>
        {formats.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </SelectField>

      <p style={{ margin: 0, color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }}>{format?.what}</p>

      {format?.subject === 'listing' ? (
        <TextField
          label="Listing"
          hint="MLS number or street address"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          required
        />
      ) : null}

      {format?.subject === 'place' ? (
        <SelectField label="Place" value={query} onChange={(e) => setQuery(e.target.value)}>
          <option value="">Choose a community</option>
          {places.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.label}
            </option>
          ))}
        </SelectField>
      ) : null}

      <div>
        <Button type="submit" disabled={pending || (format?.subject !== 'none' && !query.trim())}>
          {pending ? 'Producing, this takes a couple of minutes' : 'Produce a draft'}
        </Button>
      </div>

      {error ? (
        <p style={{ margin: 0, color: 'var(--a-danger)', fontSize: 'var(--a-text-sm)' }}>{error}</p>
      ) : null}
      {note ? (
        <p style={{ margin: 0, color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }}>{note}</p>
      ) : null}
    </form>
  )
}

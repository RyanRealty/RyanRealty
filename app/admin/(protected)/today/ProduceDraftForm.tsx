'use client'

/**
 * Today-adjacent G2 produce door. Names a live listing (or GBP market
 * update), runs Imagine, and lands a draft on the same ready lane.
 * Does not approve and does not post.
 */
import { useState, useTransition } from 'react'
import { Button, SelectField, TextField } from '@/components/admin/v2'
import { produceImagineDraftToday } from './actions'

export function ProduceDraftForm() {
  const [kind, setKind] = useState<'listing' | 'gbp'>('listing')
  const [query, setQuery] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
    startTransition(async () => {
      const result = await produceImagineDraftToday({ kind, query }) // hydration-safe
      if (result.error) {
        setError(result.error)
        return
      }
      setOk('Draft is on Today. It is not posted.')
      setQuery('')
    })
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10, margin: '0 0 16px' }}>
      <SelectField
        label="Produce"
        value={kind}
        onChange={(e) => setKind(e.target.value === 'gbp' ? 'gbp' : 'listing')}
      >
        <option value="listing">Live listing</option>
        <option value="gbp">GBP market update</option>
      </SelectField>
      {kind === 'listing' ? (
        <TextField
          label="Listing"
          hint="MLS number or street address"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          required
        />
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Producing' : 'Produce draft'}
        </Button>
      </div>
      {error ? (
        <p style={{ margin: 0, color: 'var(--a-danger)', fontSize: 'var(--a-text-sm)' }}>{error}</p>
      ) : null}
      {ok ? (
        <p style={{ margin: 0, color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }}>{ok}</p>
      ) : null}
    </form>
  )
}

/** Empty vs error copy for the admin listings browser. */

export type ListingsEmptyInput = {
  error: string | null
  total: number
  hasFilters: boolean
}

export type ListingsEmptyCopy = {
  tone: 'ok' | 'attention'
  headline: string
  body: string
}

export function listingsFeedCopy(input: ListingsEmptyInput): ListingsEmptyCopy {
  if (input.error) {
    return {
      tone: 'attention',
      headline: 'Listings could not be read.',
      body: 'The database did not answer. This is not an empty feed. Try again, or check sync once the database is back.',
    }
  }
  if (input.total === 0 && input.hasFilters) {
    return {
      tone: 'attention',
      headline: 'No listings match these filters.',
      body: 'Try a different address or status, or clear the filters to widen the results.',
    }
  }
  if (input.total === 0) {
    return {
      tone: 'attention',
      headline: 'No listings in this view.',
      body: 'The read succeeded and returned no rows. Check sync if that is unexpected.',
    }
  }
  return {
    tone: 'ok',
    headline: '',
    body: '',
  }
}

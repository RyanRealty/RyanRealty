export type PublishedListingHistoryActionEvent = {
  id: string
  listing_key: string
  event_date: string
  event_type: 'new_listing' | 'price_change' | 'status_change' | 'back_on_market' | 'closed'
  label: string
  price: number | null
  old_value: string | null
  new_value: string | null
  change_pct: number | null
}

function formatHistoryPrice(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return 'N/A'
  return `$${Number(price).toLocaleString()}`
}

/** Map publishListingHistory event names without requiring listing_history.raw. */
export function mapPublishedHistoryEvent(
  input: {
    id?: string
    event?: string | null
    event_date?: string | null
    price?: number | null
    price_change?: number | null
  },
  listingKey: string,
  index: number,
): PublishedListingHistoryActionEvent | null {
  const publishedEvent = String(input.event ?? '').toLowerCase().replace(/[\s_-]+/g, '')
  const eventDate = input.event_date ?? ''
  const price = input.price ?? null
  if (input.event === 'NewListing' || publishedEvent === 'listed' || publishedEvent === 'newlisting') {
    return {
      id: input.id ?? `lh-new-${index}`,
      listing_key: listingKey,
      event_date: eventDate,
      event_type: 'new_listing',
      label: `Listed at ${formatHistoryPrice(price)}`,
      price,
      old_value: null,
      new_value: null,
      change_pct: null,
    }
  }
  if (publishedEvent === 'pending' || publishedEvent === 'statuspending') {
    return {
      id: input.id ?? `lh-pending-${index}`,
      listing_key: listingKey,
      event_date: eventDate,
      event_type: 'status_change',
      label: 'Pending',
      price,
      old_value: null,
      new_value: 'Pending',
      change_pct: null,
    }
  }
  if (publishedEvent === 'pricechange' || publishedEvent === 'pricedrop' || publishedEvent === 'priceincrease') {
    return {
      id: input.id ?? `lh-price-${index}`,
      listing_key: listingKey,
      event_date: eventDate,
      event_type: 'price_change',
      label: `Price changed to ${formatHistoryPrice(price)}`,
      price,
      old_value: null,
      new_value: price != null ? String(price) : null,
      change_pct: input.price_change ?? null,
    }
  }
  if (input.event === 'BackOnMarket' || publishedEvent === 'backonmarket') {
    return {
      id: input.id ?? `lh-bom-${index}`,
      listing_key: listingKey,
      event_date: eventDate,
      event_type: 'back_on_market',
      label: `Back on market at ${formatHistoryPrice(price)}`,
      price,
      old_value: null,
      new_value: null,
      change_pct: null,
    }
  }
  return null
}

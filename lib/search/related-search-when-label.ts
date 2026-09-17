/**
 * Ledger "when" stamp for a related-search row. Never the place name — that
 * stamped "STAATS" on every Staats-page row. Derive a category from the
 * preset slug on the href so the left column reads Price / Type / Feature.
 */
export function relatedSearchWhenLabel(href: string): string {
  const slug = href.split('/').filter(Boolean).pop()?.toLowerCase() ?? ''
  if (/^(under|over|luxury)/.test(slug) || (/-\d/.test(slug) && /(k|m)$/.test(slug))) return 'Price'
  if (
    /(single-family|condo|townhome|townhouse|manufactured|multi-family|land|lot|cabin|farm)/.test(
      slug,
    )
  ) {
    return 'Type'
  }
  if (/(with-|pool|view|acreage|waterfront|garage|shop|rv|golf|horse|adu)/.test(slug)) {
    return 'Feature'
  }
  if (/(new-listing|open-house|pending|coming-soon|price-drop)/.test(slug)) return 'Status'
  return 'Filter'
}

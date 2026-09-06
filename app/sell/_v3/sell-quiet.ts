/**
 * Quiet items for the Sell shop: situation, FAQ, track-record trace, doors.
 */
import type { V3QuietItem } from '@/components/site/v3'
import { CONTACT } from '@/lib/brand/contact'
import { formatPrice, formatPriceCompact } from '@/lib/format/money'
import { listingsBrowsePath, valuationPath } from '@/lib/slug'
import { FORM_ANCHOR, TRACK_RECORD_TRACE } from './sell-constants'

export type SellFaqItem = { question: string; answer: string }

export type SellTrackRecord = {
  homesSold: number
  totalVolume: number
  avgSalePrice: number
}

export function buildSellQuietItems(opts: {
  faq: readonly SellFaqItem[]
  trackRecord: SellTrackRecord | null
  extraProse?: readonly { term: string; body: string }[]
  formHref?: string
  valuationHref?: string
}): V3QuietItem[] {
  const formHref = opts.formHref ?? FORM_ANCHOR
  const items: V3QuietItem[] = []

  for (const extra of opts.extraProse ?? []) {
    items.push({ kind: 'prose', term: extra.term, body: extra.body })
  }

  for (const item of opts.faq) {
    items.push({ kind: 'prose', term: item.question, body: item.answer })
  }

  if (opts.trackRecord) {
    const volume = formatPriceCompact(opts.trackRecord.totalVolume)
    const avg = formatPrice(opts.trackRecord.avgSalePrice)
    items.push({
      kind: 'prose',
      term: 'Closed sales listed by Ryan Realty',
      body: `${opts.trackRecord.homesSold.toLocaleString('en-US')} homes sold, ${volume} closed volume, ${avg} average sale price. ${TRACK_RECORD_TRACE}`,
    })
  }

  items.push(
    { label: 'Value my home', href: formHref },
    { label: 'Written valuation page', href: opts.valuationHref ?? valuationPath() },
    { label: `Call ${CONTACT.phoneDirect}`, href: `tel:${CONTACT.phoneDirectTel}` },
    { label: 'The 3% listing plan', href: '#listing-plan' },
    { label: 'Browse homes for sale', href: listingsBrowsePath() },
  )

  return items
}

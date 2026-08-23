export const OFFER_STATUSES = ['received', 'countered', 'accepted', 'rejected', 'expired'] as const
export type OfferStatus = (typeof OFFER_STATUSES)[number]

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  received: 'Received',
  countered: 'Countered',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
}

export const FINANCING_TYPES = ['conventional', 'fha', 'va', 'cash', 'other'] as const
export type FinancingType = (typeof FINANCING_TYPES)[number]

export const FINANCING_LABEL: Record<string, string> = {
  conventional: 'Conventional',
  fha: 'FHA',
  va: 'VA',
  cash: 'Cash',
  other: 'Other',
}

export type DealOffer = {
  id: string
  dealId: string
  buyerName: string
  buyerAgent: string | null
  price: number | null
  earnestMoney: number | null
  financingType: string | null
  closeDate: string | null
  contingencies: string | null
  status: OfferStatus
  submittedAt: string | null
}

export const OFFER_COMPARE_ROWS = [
  { key: 'status', label: 'Status' },
  { key: 'buyerName', label: 'Buyer' },
  { key: 'buyerAgent', label: 'Buyer agent' },
  { key: 'price', label: 'Price' },
  { key: 'earnestMoney', label: 'Earnest' },
  { key: 'financingType', label: 'Financing' },
  { key: 'closeDate', label: 'Closes' },
  { key: 'contingencies', label: 'Contingencies' },
] as const

export function formatOfferMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(n))
}

export function offerCompareValue(offer: DealOffer, key: (typeof OFFER_COMPARE_ROWS)[number]['key']): string {
  switch (key) {
    case 'status':
      return OFFER_STATUS_LABEL[offer.status] ?? offer.status
    case 'buyerName':
      return offer.buyerName || '—'
    case 'buyerAgent':
      return offer.buyerAgent || '—'
    case 'price':
      return formatOfferMoney(offer.price)
    case 'earnestMoney':
      return formatOfferMoney(offer.earnestMoney)
    case 'financingType':
      return FINANCING_LABEL[offer.financingType ?? ''] ?? offer.financingType ?? '—'
    case 'closeDate':
      return offer.closeDate ? String(offer.closeDate).slice(0, 10) : '—'
    case 'contingencies':
      return offer.contingencies?.trim() || '—'
    default:
      return '—'
  }
}

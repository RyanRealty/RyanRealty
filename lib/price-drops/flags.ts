/**
 * Price-drops deal filters that stay off until Matt turns them on.
 *
 * Remarks and REO/short-sale reads can quote listing text or distressed-sale
 * status. Both default OFF. When off, the page must not fetch, render,
 * serialize, or log those fields.
 */

export const PRICE_DROPS_REMARKS_FILTERS_ENV = 'PRICE_DROPS_REMARKS_FILTERS'
export const PRICE_DROPS_REO_FILTER_ENV = 'PRICE_DROPS_REO_FILTER'

function envOn(name: string): boolean {
  const raw = process.env[name]
  return raw === '1' || raw === 'true'
}

/** Public-remarks seller-credit matching. Default off. */
export function priceDropRemarksFiltersEnabled(): boolean {
  return envOn(PRICE_DROPS_REMARKS_FILTERS_ENV)
}

/** Bank-owned / short-sale / foreclosure filter. Default off. */
export function priceDropReoFilterEnabled(): boolean {
  return envOn(PRICE_DROPS_REO_FILTER_ENV)
}

export type PriceDropFilterFlags = {
  remarks: boolean
  reo: boolean
}

export function priceDropFilterFlags(): PriceDropFilterFlags {
  return {
    remarks: priceDropRemarksFiltersEnabled(),
    reo: priceDropReoFilterEnabled(),
  }
}

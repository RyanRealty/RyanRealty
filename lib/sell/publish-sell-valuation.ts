/**
 * /sell valuation spine lock (R-096, R-132, PUBLIC decisions).
 *
 * Step 1 is address only. Step 2 requires email. Name and phone are
 * optional. Confirmation names the 24-hour written CMA, never a
 * business-day hedge. Founding fleet slice: /sell name-required +
 * missing 24-hour confirm (2026-08-17).
 */

export const SELL_VALUATION_CONFIRM_SLA = 'within 24 hours'

export function sellQualifyNameRequired(): false {
  return false
}

export function publishSellValuationConfirm(isHot: boolean): string {
  const sla = `We will prepare a comparative market analysis from recent local sales and send it ${SELL_VALUATION_CONFIRM_SLA}.`
  const follow = isHot
    ? ' Your timeline is short, so a broker will reach out soon to walk through the number.'
    : ' A broker will follow up with the number and answer questions.'
  return `${sla}${follow}`
}

/**
 * "Why this list price" print section. Same facts as the immersive why scene.
 */

import { dateLong, escapeHtml, usd } from '@/lib/cma/render-blocks'
import { compsPriceChartSvg } from '@/lib/cma/comps-price-chart'
import { isClientInternalLeak, whyThisListPrice } from '@/lib/cma/client-facing'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaEquityPosition } from '@/lib/cma/equity'
import type { ExpiredAuditData } from '@/lib/cma/expired-audit'
import type { CmaPageDef } from '@/lib/cma/render-use-of-property'

const esc = escapeHtml

export function whyPage(input: {
  subject: CmaSubject
  comps: readonly CmaAdjustedComp[]
  market: CmaMarketContext | null
  pricing: CmaPricing
  equity?: CmaEquityPosition | null
  expiredAudit?: ExpiredAuditData | null
  generatedAtIso: string
  excludedOutliers: Array<{ address: string; closePrice: number; ppsf: number; reason: string }>
}): CmaPageDef {
  const why = whyThisListPrice(input)
  const outliers = input.excludedOutliers.filter((o) => !isClientInternalLeak(o.reason))
  const bullets = why.bullets
    .map((b) => `<li><strong>${esc(b.label)}</strong> ${esc(b.text)}</li>`)
    .join('')
  const chart = compsPriceChartSvg({
    comps: input.comps,
    recommended: input.pricing.recommended,
  })
  return {
    meta: `${esc(input.subject.streetAddress)} · ${esc(why.heading)}`,
    toc: why.heading,
    body: `
  <h2 class="section">${esc(why.heading)}</h2>
  <p>${esc(why.coverSentence)}</p>
  ${chart ? `<div class="chart-block" data-anim="chart">${chart}</div>` : ''}
  ${bullets ? `<h3 class="subhead">What the sales adjust to</h3><ul class="note-list">${bullets}</ul>` : ''}
  ${why.market ? `<h3 class="subhead">The market</h3><p>${esc(why.market)}</p>` : ''}
  ${why.ownership ? `<h3 class="subhead">Ownership</h3><p>${esc(why.ownership)}</p>` : ''}
  ${why.strategy ? `<h3 class="subhead">How the list was set</h3><p>${esc(why.strategy)}</p>` : ''}
  ${
    outliers.length > 0
      ? `<h3 class="subhead">Sales that were pulled and then excluded</h3><ul class="note-list">${outliers.map((o) => `<li>${esc(o.address)} (${usd(o.closePrice)}): ${esc(o.reason)}.</li>`).join('')}</ul>`
      : ''
  }
  <div class="trace">
    <div class="t-hd">Sources</div>
    Closed MLS sales from the Oregon Data Share MLS, pulled ${dateLong(input.generatedAtIso)}. Automated estimates are not used.
  </div>`,
  }
}

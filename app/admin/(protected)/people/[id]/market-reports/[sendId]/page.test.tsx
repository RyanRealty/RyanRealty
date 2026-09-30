import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * The admin copy of a sent report (review 2026-09-30): the stored html carries
 * the contact's LIVE links. Framed on the admin record, every one of them must
 * be re-signed as a preview, so a broker clicking Resume or Stop there can
 * never act as her.
 */

const h = vi.hoisted(() => ({ send: null as Record<string, unknown> | null }))

vi.mock('@/lib/admin/require-admin', () => ({
  requireAdminPage: async () => ({ email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' }),
}))
vi.mock('@/app/actions/crm', () => ({ requirePersonInScope: async () => ({ ok: true }) }))
vi.mock('@/lib/data/crm/marketReportSends', () => ({ getMarketReportSendById: async () => h.send }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))

import MarketReportSendPage from './page'
import { reportEmailLinks, verifyReportLinkToken } from '@/lib/email/report-link-token'

function unescapeAttr(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

async function render(): Promise<string> {
  const el = await MarketReportSendPage({ params: Promise.resolve({ id: '64138', sendId: '5' }) })
  return renderToStaticMarkup(el)
}

beforeEach(() => {
  const live = reportEmailLinks({ personId: 64138, subscriptionId: 9016, emailKey: 'market-report:scheduled:9016:first' })
  h.send = {
    id: 5,
    personId: 64138,
    subscriptionId: 9016,
    emailKey: 'market-report:scheduled:9016:first',
    broker: 'matt',
    kind: 'scheduled',
    status: 'sent',
    holdReason: null,
    error: null,
    messageId: 'msg-1',
    recipientEmail: 'cheryl@example.com',
    attemptedAt: '2026-09-30T16:00:00Z',
    sentAt: '2026-09-30T16:00:05Z',
    frequency: 'monthly',
    areas: ['bend'],
    subject: 'Bend is a seller’s market with 3.6 months of supply',
    html: `<!doctype html><html><head></head><body><a href="${live.viewUrl}">View this report online</a> <a href="${live.manageUrl}">Manage your report</a> <a href="${live.unsubscribeUrl}">Unsubscribe</a></body></html>`,
    plainText: 'x',
    figures: [],
    sparkCheck: {
      verdict: 'ok',
      rule: 'CLAUDE.md §0: any |delta| > 1% is a STOP',
      checkedAt: '2026-09-30T16:00:00Z',
      since: '2025-09-01',
      checks: [{ area: 'bend', figure: 'homes for sale', supabase: 727, spark: 727, deltaPct: 0, population: "Market Truth city: MLS City 'Bend'", status: 'ok' }],
      queries: [{ kind: 'active', filter: "Spark v1 /listings _filter=City Eq 'Bend'", total_rows: 727, rows: 727, attempts: 1, fetched_at: '2026-09-30T16:00:00Z' }],
      polygonGaps: [],
      error: null,
    },
  }
})

describe('admin market report page', () => {
  it('frames the stored copy with every one of her links re-signed as a preview', async () => {
    const html = await render()
    const srcdoc = unescapeAttr(/srcDoc="([^"]*)"|srcdoc="([^"]*)"/.exec(html)?.slice(1).find(Boolean) ?? '')
    expect(srcdoc).toContain('Manage your report')
    const tokens = [...srcdoc.matchAll(/\?t=([^&"]+)/g)].map((m) => verifyReportLinkToken(decodeURIComponent(m[1]!)))
    expect(tokens).toHaveLength(3)
    for (const t of tokens) expect(t).toMatchObject({ personId: 64138, subscriptionId: 9016, preview: true })
  })

  it('shows the Spark cross-check the send passed, with both values and the query', async () => {
    const html = await render()
    expect(html).toContain('Spark cross-check (CLAUDE.md §0)')
    expect(html).toContain('Every printed figure reconciled with Spark within 1%.')
    expect(html).toContain('bend · homes for sale')
    expect(html).toContain('City Eq &#x27;Bend&#x27;')
  })
})

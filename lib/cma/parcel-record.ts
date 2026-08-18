/**
 * County parcel record for the seller CMA: the full DIAL deed chain and
 * permits of record. Municipal Bend homes were skipped by the rural-only
 * DIAL scrape in county.ts. This unit runs for every Deschutes address
 * that resolves an assessor account. Numbers stay off this file.
 */

import { dateLong, escapeHtml, usd } from '@/lib/cma/render-blocks'
import { deriveOwnershipFromSales, parseDialSalesHistory, type DialSaleRow } from '@/lib/expired-owner-lookup'
import type { CmaSubject } from '@/lib/cma/types'

const esc = escapeHtml
const DIAL = 'https://dial.deschutes.org'
const DIAL_PERMITS = (account: string) => `${DIAL}/Real/Permits/${encodeURIComponent(account)}`
const DIAL_SALES = (account: string) => `${DIAL}/Real/Sales/${encodeURIComponent(account)}`

async function fetchDialSalesHistory(accountId: string): Promise<DialSaleRow[]> {
  const id = accountId.trim()
  if (!/^\d+$/.test(id)) return []
  try {
    const res = await fetch(DIAL_SALES(id), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []
    return parseDialSalesHistory(await res.text())
  } catch {
    return []
  }
}

export type ParcelPermit = {
  type: string
  permit: string
}

export type ParcelRecord = {
  taxAccount: string
  currentOwner: string | null
  ownedSince: string | null
  acquiredAt: number | null
  sales: DialSaleRow[]
  permits: ParcelPermit[]
  source: string
  agentNotes: string[]
}

export function parseDialPermitsHtml(html: string): ParcelPermit[] {
  const permits: ParcelPermit[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/247-?([A-Z]{1,2})(\d{2,6})/g)) {
    const permit = m[0]
    if (seen.has(permit)) continue
    seen.add(permit)
    const letter = (m[1] ?? '').toUpperCase()
    const type =
      letter === 'S'
        ? 'Onsite septic'
        : letter === 'E'
          ? 'Electrical'
          : letter === 'P'
            ? 'Plumbing'
            : letter === 'M'
              ? 'Mechanical'
              : letter === 'B'
                ? 'Building'
                : /^(CU|LM|DR|TU|LR|MC|MA|PA|TP)/.test(letter)
                  ? 'Land-use'
                  : 'Permit'
    permits.push({ type, permit })
    if (permits.length >= 24) break
  }
  return permits
}

export function composeParcelRecord(input: {
  taxAccount: string
  currentOwner: string | null
  sales: DialSaleRow[]
  permits: ParcelPermit[]
}): ParcelRecord | null {
  const taxAccount = input.taxAccount.trim()
  if (!/^\d+$/.test(taxAccount)) return null
  if (input.sales.length === 0 && input.permits.length === 0) return null
  const tenure = deriveOwnershipFromSales(input.sales, input.currentOwner)
  const sales = [...input.sales].sort((a, b) => a.date.localeCompare(b.date))
  const arms = sales.filter((s) => {
    const buyer = (s.buyer.split(/[,\s]+/)[0] ?? '').toUpperCase()
    const seller = (s.seller.split(/[,\s]+/)[0] ?? '').toUpperCase()
    return buyer && seller && buyer !== seller
  })
  const byType = new Map<string, number>()
  for (const p of input.permits) byType.set(p.type, (byType.get(p.type) ?? 0) + 1)
  const permitLine =
    input.permits.length > 0
      ? `${input.permits.length} permits of record (${[...byType.entries()].map(([t, n]) => `${n} ${t.toLowerCase()}`).join(', ')}).`
      : 'No Deschutes DIAL permits surfaced for this account.'
  const agentNotes = [
    input.currentOwner ? `Owner of record: ${input.currentOwner}.` : null,
    tenure
      ? `Current tenure began ${tenure.since}${tenure.salePrice != null ? ` at ${usd(tenure.salePrice)}` : ''}.`
      : null,
    arms.length > 0 ? `${arms.length} arms-length transfers on the county deed table.` : null,
    permitLine,
  ].filter((n): n is string => Boolean(n))
  return {
    taxAccount,
    currentOwner: input.currentOwner,
    ownedSince: tenure?.since ?? null,
    acquiredAt: tenure?.salePrice ?? null,
    sales,
    permits: input.permits,
    source: `Deschutes County DIAL account ${taxAccount}`,
    agentNotes,
  }
}

export async function resolveParcelRecord(subject: Pick<CmaSubject, 'streetAddress' | 'city'>): Promise<ParcelRecord | null> {
  try {
    const { deschutesCountyOwner } = await import('@/lib/owner-resolution.mjs')
    const county = await deschutesCountyOwner(subject.streetAddress, subject.city)
    const taxAccount = county?.accountId?.trim() ?? ''
    if (!/^\d+$/.test(taxAccount)) return null
    const [sales, permitHtml] = await Promise.all([
      fetchDialSalesHistory(taxAccount),
      fetch(DIAL_PERMITS(taxAccount), {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      })
        .then((r) => (r.ok ? r.text() : ''))
        .catch(() => ''),
    ])
    return composeParcelRecord({
      taxAccount,
      currentOwner: county?.ownerRaw?.trim() || null,
      sales,
      permits: parseDialPermitsHtml(permitHtml),
    })
  } catch (err) {
    console.warn('[parcel-record] resolve failed:', err)
    return null
  }
}

function money(n: number | null): string {
  return n != null && Number.isFinite(n) ? usd(n) : '—'
}

function party(name: string): string {
  const t = name.trim()
  if (!t || /^unknown$/i.test(t)) return 'Not recorded'
  return t
}

export function renderParcelRecordHtml(record: ParcelRecord | null | undefined): string {
  if (!record) return ''
  const sales = record.sales
    .map(
      (s) =>
        `<tr><td>${esc(dateLong(s.date))}</td><td>${esc(party(s.seller))}</td><td>${esc(party(s.buyer))}</td><td class="num">${money(s.amount)}</td></tr>`,
    )
    .join('')
  const permitRows = record.permits
    .map((p) => `<li><strong>${esc(p.type)}</strong> ${esc(p.permit)}</li>`)
    .join('')
  const tenure =
    record.ownedSince != null
      ? `The current owner of record has held this house since ${esc(dateLong(record.ownedSince))}${
          record.acquiredAt != null ? ` at ${money(record.acquiredAt)}` : ''
        }.`
      : ''
  return `
  <h2 class="section">Who has owned this house</h2>
  ${tenure ? `<p>${tenure}</p>` : ''}
  ${
    sales
      ? `<table class="comps">
    <thead><tr><th>Recorded</th><th>From</th><th>To</th><th class="num">Consideration</th></tr></thead>
    <tbody>${sales}</tbody>
  </table>`
      : ''
  }
  ${permitRows ? `<h3 class="subhead">Permits of record</h3><ul class="note-list">${permitRows}</ul>` : ''}
  <p class="small">${esc(record.source)}.</p>`
}

export function renderParcelRecordScene(record: ParcelRecord | null | undefined): string {
  const body = renderParcelRecordHtml(record)
  if (!body) return ''
  return `
  <section class="sc sc-cream" id="ownership">
    <div class="in">
      <div class="kick r">The parcel</div>
      <div class="r facts-block">${body}</div>
    </div>
  </section>`
}

/**
 * CountyRecordsSection (Matt 2026-10-14): "check county records to see whether
 * they own a home, and which one."
 *
 * For a known contact only, on the admin person page only. Never a public
 * page, an email, or an export. Every ownership line on it comes from a county
 * owner-of-record row the section names (Deschutes or Crook, read live, or the
 * west Bend assessor export when Deschutes does not answer), with its read or
 * load date. Matching rules: lib/crm/county-owner-match.ts. Data:
 * getCountyOwnershipForPerson (lib/data/crm/getCountyOwnership.ts).
 *
 * Async server component; streams under Suspense because a county read can
 * take a few seconds the first time in a day.
 */
import { SectionHead, StateWord, type AdminState } from '@/components/admin/v2'
import { formatCalendarDay, formatDate } from '@/lib/format/date'
import { formatPriceExact } from '@/lib/format/money'
import {
  getCountyOwnershipForPerson,
  type CountyOwnershipResult,
  type CountyOwnershipRow,
} from '@/lib/data/crm/getCountyOwnership'

const STATE: Record<CountyOwnershipRow['strength'], AdminState> = {
  high: 'ok',
  medium: 'waiting',
  resident: 'slow',
}

const muted = { fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 } as const

function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** What was searched, where, and what could not be. Exported for the unit test. */
export function searchedLine(r: CountyOwnershipResult): string[] {
  if (r.searchedNames.length === 0 && r.searchedAddresses.length === 0) {
    return ['Nothing to search: this contact has no first and last name and no street address.']
  }
  if (r.counties.length > 0 && r.counties.every((c) => c.status === 'not-searched')) {
    return ['Nothing on this contact could go into a county search: the name and addresses are not in a form the county records use.']
  }
  const what: string[] = []
  if (r.searchedNames.length > 0) what.push(joinWords(r.searchedNames))
  if (r.searchedAddresses.length > 0) {
    what.push(r.searchedAddresses.length === 1 ? '1 address' : `${r.searchedAddresses.length} addresses`)
  }
  const answered = r.counties.filter((c) => c.status === 'ok' || c.status === 'partial').map((c) => c.label.replace(/ County$/, ''))
  const down = r.counties.filter((c) => c.status === 'unavailable').map((c) => c.label)
  const partial = r.counties.filter((c) => c.status === 'partial').map((c) => c.label)
  const lines: string[] = []
  lines.push(
    answered.length > 0
      ? `Searched ${joinWords(answered)} County owner records for ${what.join(' and ')}. Jefferson County publishes no owner records, so a home there will not show.`
      : `No county answered the search for ${what.join(' and ')}.`,
  )
  if (down.length > 0 || partial.length > 0) {
    const westside = (down.includes('Deschutes County') || partial.includes('Deschutes County')) && r.snapshotLoadedAt
    const parts = [
      down.length > 0 ? `${joinWords(down)} did not answer just now.` : '',
      partial.length > 0 ? `${joinWords(partial)} answered only part of the search just now.` : '',
      westside ? `West Bend rows marked as the assessor export come from the export loaded ${formatDate(r.snapshotLoadedAt)}.` : '',
    ]
    lines.push(parts.filter(Boolean).join(' '))
  }
  const truncated = r.counties.filter((c) => c.truncated).map((c) => c.label)
  if (truncated.length > 0) {
    lines.push(`${joinWords(truncated)} matched more owners by name than one read returns, so a parcel under a common name may be missing.`)
  }
  return lines
}

function figuresLine(row: CountyOwnershipRow): string | null {
  const f = row.figures
  if (!f) return null
  const parts: string[] = []
  if (f.assessedValue != null) parts.push(`Assessed ${formatPriceExact(f.assessedValue)}`)
  if (f.marketValue != null) parts.push(`market ${formatPriceExact(f.marketValue)}`)
  if (f.lastSaleDate) {
    parts.push(
      `last sale ${formatCalendarDay(f.lastSaleDate)}${f.lastSalePrice != null ? ` for ${formatPriceExact(f.lastSalePrice)}` : ''}`,
    )
  }
  const asOf = `assessor export loaded ${formatDate(f.asOf)}`
  if (f.ownerChangedSince) {
    return `${parts.join(', ')} (${asOf}). The owner has changed since that export, so its sale figures are left out.`
  }
  return parts.length > 0 ? `${parts.join(', ')} (${asOf}).` : null
}

function sourceLine(row: CountyOwnershipRow): string {
  const ids = [`account ${[row.account, ...row.otherAccounts].join(', ')}`]
  if (row.taxlot) ids.push(`taxlot ${row.taxlot}`)
  if (row.propertyClass) ids.push(row.propertyClass)
  const when = row.sourceAsOf ? `${row.sourceIsLive ? 'read' : 'loaded'} ${formatDate(row.sourceAsOf)}` : null
  return [row.countyLabel, ...ids, `${row.source}${when ? `, ${when}` : ''}`].join(' · ')
}

function ParcelRow({ row }: { row: CountyOwnershipRow }) {
  const place = row.situsAddress ?? `No site address on account ${row.account}`
  const figures = figuresLine(row)
  return (
    <li className="av2-quiet" style={{ alignItems: 'flex-start' }}>
      {row.recordUrl ? (
        <a
          href={row.recordUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="av2-quiet__name"
          style={{ color: 'var(--a-accent)', textDecoration: 'none' }}
        >
          {place}
        </a>
      ) : (
        <span className="av2-quiet__name">{place}</span>
      )}
      <StateWord state={STATE[row.strength]}>{row.strengthLabel}</StateWord>
      <div style={{ flexBasis: '100%', display: 'grid', gap: 4 }}>
        <p style={{ ...muted, color: 'var(--a-text)' }}>{row.explanation}</p>
        {figures ? <p style={muted}>{figures}</p> : null}
        <p style={{ ...muted, fontSize: 'var(--a-text-xs)' }}>{sourceLine(row)}</p>
      </div>
    </li>
  )
}

export async function CountyRecordsSection({ personId, hideHeading = false }: { personId: number; hideHeading?: boolean }) {
  let result: CountyOwnershipResult | null = null
  try {
    result = await getCountyOwnershipForPerson(personId)
  } catch (err) {
    console.error('[CountyRecordsSection]', err instanceof Error ? err.message : err)
  }

  return (
    <section aria-label="County records" id="county-records">
      {hideHeading ? null : <SectionHead>County records</SectionHead>}
      {!result ? (
        <p style={muted}>County records could not be read just now. Reload the page to try again.</p>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 4, margin: '0 0 10px' }}>
            {searchedLine(result).map((line) => (
              <p key={line} style={muted}>
                {line}
              </p>
            ))}
          </div>
          {result.rows.length > 0 ? (
            <ul className="av2-quietlist">
              {result.rows.map((row) => (
                <ParcelRow key={row.key} row={row} />
              ))}
            </ul>
          ) : result.counties.some((c) => c.status === 'ok' || c.status === 'partial') ? (
            <p style={{ ...muted, marginBottom: 16 }}>
              No owner record names them, and no address we hold for them is a parcel in these counties.
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

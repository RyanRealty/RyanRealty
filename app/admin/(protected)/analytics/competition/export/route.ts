/**
 * CSV export for CO competition desk (admin only).
 * kind=offices | agents; optional office= exact ListOfficeName / buyer_office_name string.
 * Competitor names stay admin-only — not for public site (I6 lock).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getCoOfficeShare } from '@/lib/data/analytics/getCoOfficeShare'
import { getCoAgentShare } from '@/lib/data/analytics/getCoAgentShare'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function csvEscape(value: string | number): string {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function parseYear(raw: string | null): number {
  const n = Number(raw)
  if (Number.isFinite(n) && n >= 1998 && n <= 2030) return n
  return 2024
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const year = parseYear(sp.get('year'))
  const side = sp.get('side') === 'buy' ? 'buy' : 'list'
  const kind = sp.get('kind') === 'agents' ? 'agents' : 'offices'
  const office = sp.get('office')?.trim() || undefined

  if (kind === 'agents') {
    const agents = await getCoAgentShare({
      year,
      side,
      limit: 100,
      officeName: office,
    })
    const header = [
      'rank',
      'agent_name',
      'office_name',
      'sides_count',
      'total_volume',
      'volume_share_pct',
      'year',
      'side',
    ]
    const lines = [
      header.join(','),
      ...agents.rows.map((r) =>
        [
          r.rank,
          csvEscape(r.agentName),
          csvEscape(r.officeName),
          r.sidesCount,
          r.totalVolume,
          r.volumeSharePct.toFixed(4),
          year,
          side,
        ].join(','),
      ),
    ]
    const officeSlug = office
      ? `-${office.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 40)}`
      : ''
    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="co-agents-${year}-${side}${officeSlug}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const share = await getCoOfficeShare({ year, side, limit: 200 })
  const header = [
    'rank',
    'office_name',
    'sides_count',
    'total_volume',
    'volume_share_pct',
    'unit_share_pct',
    'year',
    'side',
  ]
  const lines = [
    header.join(','),
    ...share.rows.map((r) =>
      [
        r.rank,
        csvEscape(r.officeName),
        r.sidesCount,
        r.totalVolume,
        r.volumeSharePct.toFixed(4),
        r.unitSharePct.toFixed(4),
        year,
        side,
      ].join(','),
    ),
  ]
  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="co-offices-${year}-${side}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}

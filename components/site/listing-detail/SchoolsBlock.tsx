import { V3Ledger, v3Text, type V3LedgerPlainRow } from '@/components/site/v3'
import { findSchoolByName } from '@/data/co-schools'
import type { ListingDetail } from '@/lib/data/types/listing'

type Props = {
  listing: Pick<
    ListingDetail,
    'elementarySchool' | 'middleSchool' | 'highSchool' | 'schoolDistrict'
  >
  className?: string
}

function cleanField(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.startsWith('***')) return null
  return trimmed
}

export function SchoolsBlock({ listing, className }: Props) {
  const cards: Array<{ level: string; name: string }> = [
    { level: 'Elementary', name: cleanField(listing.elementarySchool) ?? '' },
    { level: 'Middle', name: cleanField(listing.middleSchool) ?? '' },
    { level: 'High', name: cleanField(listing.highSchool) ?? '' },
  ].filter((c) => c.name.length > 0)

  const rows: V3LedgerPlainRow[] = cards.map((c) => {
    const registered = findSchoolByName(c.name)
    const grades = registered?.grades ?? null
    return {
      href: registered ? `/schools/${registered.slug}` : '/schools',
      when: v3Text(c.level),
      what: v3Text(c.name),
      detail: v3Text(grades ? `${grades} · nearby` : 'Nearby'),
      id: `school-${c.level}`,
    }
  })
  const [first, ...rest] = rows
  if (!first) return null

  return (
    <V3Ledger
      className={className}
      heading={v3Text('Schools nearby')}
      rows={[first, ...rest]}
    />
  )
}

import { V3Ledger, v3Text, type V3LedgerPlainRow } from '@/components/site/v3'
import type { PlaceNode } from '@/lib/data/geo/resolvePlaceContext'

type Props = {
  parents: PlaceNode[]
  eyebrow?: string
  title?: string
}

export function PlaceParentsSection({
  parents,
  eyebrow = 'Keep exploring',
  title = 'This place sits inside',
}: Props) {
  const rows: V3LedgerPlainRow[] = parents.map((p) => ({
    href: p.href,
    when: v3Text(p.type),
    what: v3Text(p.label),
    id: `${p.type}-${p.slug}`,
  }))
  const [first, ...rest] = rows
  if (!first) return null

  return (
    <V3Ledger
      heading={v3Text(title)}
      eyebrow={v3Text(eyebrow)}
      rows={[first, ...rest]}
    />
  )
}

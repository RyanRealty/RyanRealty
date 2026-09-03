import { V3Doors, v3Text, type V3Door } from '@/components/site/v3'

export function ListingMoreDoors({ doors }: { doors: readonly [V3Door, V3Door, ...V3Door[]] }) {
  return <V3Doors id="more" name={v3Text('More about this home')} doors={doors} />
}

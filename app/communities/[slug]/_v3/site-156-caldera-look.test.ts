import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { nameOnlyChildEntries } from '@/lib/explore/nearby-place-peers'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'
import { buildCommunityAmenityBoard } from './community-amenities'
import type { ResortAmenity } from '@/lib/resort-community-content'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PAGE = readFileSync(join(ROOT, '../page.tsx'), 'utf8')
const ALERTS = readFileSync(join(ROOT, 'CommunityAlertSheet.client.tsx'), 'utf8')
const VALUE = readFileSync(
  join(ROOT, '../../../../components/site/v3/V3PlaceValue.client.tsx'),
  'utf8',
)
const AMENITIES_CLIENT = readFileSync(join(ROOT, 'CommunityAmenities.client.tsx'), 'utf8')

describe('SITE-156 Caldera master-plan look', () => {
  it('refuses MLS phase-chip dumps as visitor child doors', () => {
    const rows = nameOnlyChildEntries([
      [
        { name: 'Caldera Springs, Phase C-2', href: '/subdivisions/caldera-springs-phase-c-2' },
        { name: 'Phase C1 Sfr', href: '/subdivisions/phase-c1-sfr' },
        { name: 'Olu Phase A', href: '/subdivisions/olu-phase-a' },
        { name: 'Caldera Springs Phase Three', href: '/subdivisions/caldera-springs-phase-three' },
      ],
    ])
    expect(rows.map((row) => row.name)).toEqual(['Caldera Springs Phase Three'])
    expect(publishPlatDisplayName('Sfr')).toBeNull()
    expect(publishPlatDisplayName('Olu')).toBeNull()
  })

  it('omits the empty Typical-price theater', () => {
    expect(PAGE).not.toMatch(/tooFewSalesItems/)
    expect(PAGE).toMatch(/costChart && firstMarketFigure/)
    expect(PAGE).not.toMatch(/Too few recent sales here to chart/)
  })

  it('leads amenities with named places, not DINI/RECR codes', () => {
    const caldera = JSON.parse(
      readFileSync(join(process.cwd(), 'data/resort-community-caldera-springs.json'), 'utf8'),
    ) as { name: string; amenities: ResortAmenity[] }
    const board = buildCommunityAmenityBoard({
      placeName: caldera.name,
      amenities: caldera.amenities,
      browseHref: '/homes-for-sale/sunriver/caldera-springs',
    })
    expect(board?.mix[0]?.name).toBe('Lake House')
    expect(board?.mix[0]?.amount).toBe('Lake House')
    expect(board?.mix.map((s) => s.name).join(' ')).not.toMatch(/\b(DINI|RECR|WELL|OTHE)\b/)
    expect(board?.mix.map((s) => s.amount).join(' ')).not.toMatch(/\b(Public|DINI|RECR|WELL|OTHE)\b/)
    expect(board?.mixNote).not.toBe('Grouped by kind.')
    expect(AMENITIES_CLIENT).toMatch(/board\.mix/)
  })

  it('does not repeat the new-listings sentence as a covering sticky', () => {
    expect(ALERTS).toMatch(/stickyEnabled=\{false\}/)
  })

  it('keeps email and address fields empty rather than dummy-filled', () => {
    expect(ALERTS).not.toMatch(/you@email/)
    expect(ALERTS).toMatch(/placeholder=""/)
    expect(VALUE).not.toMatch(/123 Ranch House Lane/)
    expect(VALUE).not.toMatch(/you@email\.com/)
    expect(VALUE).not.toMatch(/placeholder: 'Street address'/)
    expect(VALUE).not.toMatch(/placeholder: 'Email'/)
    expect(VALUE).toMatch(/placeholder: ''/)
  })

  it('clusters community-fold pins on a real stage instead of stacking chips', () => {
    expect(PAGE).toMatch(/clusterPins/)
    expect(PAGE).toMatch(/clusterCellPx=\{COMMUNITY_FOLD_CLUSTER_CELL_PX\}/)
    expect(PAGE).toMatch(/clusterStageHint=\{COMMUNITY_FOLD_CLUSTER_STAGE\}/)
    expect(PAGE).toMatch(/clusterStageHintPhone=\{COMMUNITY_FOLD_CLUSTER_STAGE_PHONE\}/)
  })
})

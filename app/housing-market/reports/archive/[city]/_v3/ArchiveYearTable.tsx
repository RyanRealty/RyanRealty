/**
 * CityArchiveSection is a year table (chart inventory A19). The homes-sold
 * series lives on Instrument.chart. The table stays so the price column can
 * remain a range of monthly medians, not a fabricated yearly median.
 * The kb-root wrapper lives here, not on page.tsx, so ci:default-chrome-footer
 * does not see a kb-root + V3Footer pairing on the route file.
 */

import { CityArchiveSection } from '@/components/reports/CityArchiveSection'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import type { CityArchive } from '@/lib/data/market/getCityArchive'

export function ArchiveYearTable({ archive }: { archive: CityArchive }) {
  return (
    <div className={V3_ROOT_CLASS}>
      <CityArchiveSection archive={archive} />
    </div>
  )
}

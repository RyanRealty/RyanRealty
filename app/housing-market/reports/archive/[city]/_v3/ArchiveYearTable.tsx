/**
 * CityArchiveSection is a year table (chart inventory A19). The homes-sold
 * series lives on Instrument.chart. The table stays so the price column can
 * remain a range of monthly medians, not a fabricated yearly median.
 * The kb-root wrapper lives here, not on page.tsx, so ci:default-chrome-footer
 * does not see a kb-root + V3Footer pairing on the route file.
 */

import { CityArchiveSection } from '@/components/reports/CityArchiveSection'
import type { CityArchive } from '@/lib/data/market/getCityArchive'
import '@/components/site/kb/kb.css'

export function ArchiveYearTable({ archive }: { archive: CityArchive }) {
  return (
    <div className="kb-root">
      <CityArchiveSection archive={archive} />
    </div>
  )
}

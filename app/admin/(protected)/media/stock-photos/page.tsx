// @no-parity — internal admin surface, no public mockup contract
//
// /admin/media/stock-photos — the stock search. 11C: migrated to the LOCKED
// admin v2 language (design_system/admin/ADMIN_UI.md). Presentation only.
//
// Carried over verbatim: `dynamic = 'force-dynamic'` and the
// <StockPhotosPicker /> mount (no props, untouched — a legacy client island
// that migrates with its own unit). The superuser guard lives in
// stock-photos/layout.tsx and was not touched.
//
// Shape changed, data did not: the page is now a v2 scope that opens with what
// the picker does, in the family's verdict line. The picker keeps its
// full-bleed width — no wrapper max-width — so no result thumbnail moves.
import { VerdictLine } from '@/components/admin/v2'
import StockPhotosPicker from './StockPhotosPicker'

export const dynamic = 'force-dynamic'

export default function StockPhotosPage() {
  return (
    <div className="av2-scope">
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone="ok">
          <b>One query, three stock sources.</b> Shutterstock, Pexels, and Unsplash are searched
          together and returned side by side.
        </VerdictLine>
      </div>

      <StockPhotosPicker />
    </div>
  )
}

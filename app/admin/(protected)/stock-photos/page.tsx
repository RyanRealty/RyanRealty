// @no-parity — pure redirect

/** /admin/stock-photos moved into the Media library (consolidation 2026-07-07). */

import { redirect } from 'next/navigation'

export default function StockPhotosRedirect() {
  redirect('/admin/media/stock-photos')
}

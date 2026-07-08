// @no-parity — pure redirect

/** /admin/banners moved into the Media library (consolidation 2026-07-07). */

import { redirect } from 'next/navigation'

export default function BannersRedirect() {
  redirect('/admin/media/banners')
}

// @no-parity — pure redirect

/** /admin/photos moved into the Media library (consolidation 2026-07-07). */

import { redirect } from 'next/navigation'

export default async function PhotosRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>
}) {
  const params = await searchParams
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    const one = Array.isArray(v) ? v[0] : v
    if (one) sp.set(k, one)
  }
  const qs = sp.toString()
  redirect(`/admin/media/photos${qs ? `?${qs}` : ''}`)
}

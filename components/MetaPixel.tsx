'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { IS_NON_PRODUCTION_BUILD } from '@/lib/analytics/non-production-build'
import { isPrivatePath } from '@/lib/analytics/private-paths'
import { metaPixelBootstrapScript } from '@/lib/analytics/meta-pixel-consent'

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()

/**
 * Loads the Meta Pixel when NEXT_PUBLIC_META_PIXEL_ID is set, and fires PageView.
 * Other events (ViewContent, Lead, etc.) are sent from lib/tracking.ts and the LP forms.
 *
 * Matt 2026-10-08: same default as analytics_storage. Restricted regions (EEA/UK/CH),
 * unknown region, GPC, and a stored decline do not load the pixel (no `_fbp`).
 * Elsewhere with no answer and no GPC it loads, with Limited Data Use until the
 * visitor grants marketing. Flip META_PIXEL_DEFAULT_FOLLOWS_ANALYTICS_STORAGE
 * in lib/analytics/meta-pixel-consent.ts to follow the ad_* denied default.
 *
 * The noscript img fallback is omitted: it cannot read region, GPC, or the
 * consent cookie, so it would fire where the pixel is denied.
 */
export default function MetaPixel() {
  const pathname = usePathname()
  if (IS_NON_PRODUCTION_BUILD) return null
  if (!PIXEL_ID) return null
  if (isPrivatePath(pathname)) return null

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {metaPixelBootstrapScript(PIXEL_ID)}
    </Script>
  )
}

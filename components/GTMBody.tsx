/**
 * GTM noscript iframe for <body>. Renders only when NEXT_PUBLIC_GTM_CONTAINER_ID is set.
 */

import { IS_NON_PRODUCTION_BUILD } from '@/lib/analytics/non-production-build'

const GTM_ID = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID?.trim()

export default function GTMBody() {
  if (IS_NON_PRODUCTION_BUILD) return null
  if (!GTM_ID) return null
  return (
    <noscript>
      <iframe
        title="Google Tag Manager"
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  )
}

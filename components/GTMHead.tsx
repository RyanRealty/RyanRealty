'use client'

const GTM_ID = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID?.trim()

/**
 * GTM container. Loads whenever NEXT_PUBLIC_GTM_CONTAINER_ID is set.
 * Consent Mode v2 defaults (denied) are injected by GoogleAnalytics before
 * this script; do not wait for the cookie banner or GA4 never sees denied
 * visitors and GTM's own GA4 tag double-counts the accepted ones.
 */
export default function GTMHead() {
  if (!GTM_ID) return null

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;if(f&&f.parentNode)f.parentNode.insertBefore(j,f);else d.head.appendChild(j);
})(window,document,'script','dataLayer','${GTM_ID}');`,
      }}
    />
  )
}

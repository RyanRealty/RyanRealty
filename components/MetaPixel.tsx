'use client'

import Script from 'next/script'

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()

/**
 * Loads the Meta Pixel on EVERY page load when NEXT_PUBLIC_META_PIXEL_ID is set,
 * and fires PageView. Other events (ViewContent, Lead, etc.) are sent from
 * lib/tracking.ts and the LP forms.
 *
 * Matt directive 2026-06-02: the Pixel must fire on all traffic — Meta ad
 * attribution, conversion optimization, and retargeting audiences are dead
 * without it. This matches how GA4 loads here (on every visit, via Consent
 * Mode), rather than the previous behavior where the Pixel only loaded AFTER a
 * visitor accepted the cookie banner (so it almost never fired and `fbq` was
 * undefined for most sessions).
 *
 * Privacy note: this fires before an explicit cookie opt-in. The site privacy
 * policy must disclose Meta Pixel use. For EU traffic, gate via Meta Consent
 * Mode (fbq('consent','revoke') by default, 'grant' on accept) instead.
 */
export default function MetaPixel() {
  if (!PIXEL_ID) return null

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          if(s&&s.parentNode)s.parentNode.insertBefore(t,s);else b.head.appendChild(t);}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          // Limited Data Use (CCPA/CPRA): when the visitor has NOT granted marketing
          // consent (essential-only / "Do Not Sell"), send events in LDU mode — Meta
          // still measures the conversion but excludes it from ad targeting and
          // personalization. A visitor arriving from an ad click (fbclid/gclid/utm)
          // with no explicit choice is treated as marketing-OK, mirroring
          // autoGrantConsentForAdTraffic so first-PageView attribution is preserved.
          (function(){
            var m=false;
            var raw=(document.cookie.split('; ').find(function(r){return r.indexOf('ryan_realty_cookie_consent=')===0;})||'').split('=')[1];
            if(raw){try{m=!!JSON.parse(decodeURIComponent(raw)).marketing;}catch(e){m=raw==='all';}}
            else{m=/[?&](fbclid|gclid|msclkid|ttclid|utm_)/i.test(window.location.search||'');}
            if(!m){fbq('dataProcessingOptions',['LDU'],0,0);}else{fbq('dataProcessingOptions',[]);}
          })();
          fbq('init', '${PIXEL_ID.replace(/'/g, "\\'")}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  )
}

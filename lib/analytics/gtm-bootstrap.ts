import { PRIVATE_PATH_JS } from './private-paths'
import { GA_SUPPRESS_JS } from './ga-suppression'
import { consentModeDefaultJs } from './consent-defaults'

/**
 * The inline Google Tag Manager bootstrap, as one string.
 *
 * WHY a module of its own: on 2026-09-17 (f1e2a90f9) an edit left
 * `push({'gtm.start':}}` in the template inside components/GTMHead.tsx. A script
 * with a parse error runs nothing, so gtm.js never loaded and the browser GA4
 * stream (session_start, first_visit, engagement, every client event) read
 * zero from 2026-09-18 until the 2026-09-22 visibility audit found it
 * (TRACK-2). The gates only regex the file for strings, so they passed.
 * Building the script here lets gtm-bootstrap.test.ts parse the exact string
 * the page ships, which turns that class of break into a failed test.
 */
export function gtmBootstrapScript(pageType: string, gtmId: string): string {
  // gtm.js never loads on a page whose address carries a secret (private-paths.ts);
  // GTMHead already renders nothing there, and this holds even if it did.
  // Nor on a page GA4 must not count (ga-suppression.ts, Matt 2026-10-05): /admin,
  // a host that is not ryan-realty.com, automation, or a signed-in broker's
  // browser. Decided in the browser before gtm.js is requested, so a suppressed
  // page loads no Google tag at all.
  const safePageType = pageType.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return `window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
${consentModeDefaultJs()}
window.dataLayer.push({page_type:'${safePageType}'});
(function(){try{var a=new URLSearchParams(location.search||'').get('agent');if(!a){var m=document.cookie.match(/(?:^|; )rr_agent_attribution=([^;]*)/);if(m){try{var j=JSON.parse(decodeURIComponent(m[1]));a=j&&j.slug}catch(e){a=decodeURIComponent(m[1])}}}if(!a)return;a=String(a).trim().toLowerCase();var map={matt:'matt','matt-ryan':'matt',rebecca:'rebecca','rebecca-peterson':'rebecca',paul:'paul','paul-stevenson':'paul'};var s=map[a];if(!s)return;gtag('set','user_properties',{assigned_broker:s});window.dataLayer.push({broker_slug:s,assigned_broker:s})}catch(e){}})();
if(!${PRIVATE_PATH_JS}&&!${GA_SUPPRESS_JS})(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0], // hydration-safe — GTM bootstrap stamp
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;if(f&&f.parentNode)f.parentNode.insertBefore(j,f);else d.head.appendChild(j);
})(window,document,'script','dataLayer','${gtmId}');`
}

import { PRIVATE_PATH_JS } from './private-paths'
import { GA_SUPPRESS_JS } from './ga-suppression'
import { consentModeDefaultJs } from './consent-defaults'
import { CONSENT_REGION_COOKIE, CONSENT_REGION_UNRESTRICTED_VALUE } from './consent-regions'
import { MARKET_SLUG_MAX, VISITOR_INTENTS, VISITOR_INTENT_STORAGE_KEY } from './visitor-intent'
import { CONSENT_COOKIE } from '@/lib/identity/consent'
import { GA4_STRIP_PARAMS } from '@/app/api/visitors/track/strip-identity'

/**
 * The page address GA4 may see: identity params (`_pid`, `_fuid`) and `rr_doc`
 * removed, as one JS expression. Same list as the server mirror
 * (stripGa4UrlParams). Left untouched when none is present, so the URL's own
 * encoding survives.
 */
const GA4_PAGE_LOCATION_JS = `(function(){var h=location.href;try{var u=new URL(h),t=0;${JSON.stringify(GA4_STRIP_PARAMS)}.forEach(function(p){if(u.searchParams.has(p)){u.searchParams.delete(p);t=1}});return t?u.toString():h}catch(e){return h}})()`

/**
 * The stored visitor intent and market (lib/analytics/visitor-intent.ts), as one
 * JS expression that evaluates to `{ visitor_intent?, primary_market? }`.
 *
 * The first-paint page_view is pushed here, before React hydrates, so it can
 * only carry what the browser stored on an earlier page; PageViewTracker records
 * this page on hydration and pushes the updated values for every later hit.
 * Read only when analytics consent holds, the same test as hasAnalyticsConsent:
 * GPC off, and a stored banner answer with analytics on, or no answer (no cookie,
 * or an empty one, as parseConsentCookie reads it) outside a restricted region
 * (`rr_cr=0`). Values are re-checked against the label list and
 * the slug shape. Any failure (blocked storage, bad JSON) yields `{}`.
 */
const VISITOR_INTENT_JS = `(function(){try{if(navigator.globalPrivacyControl===true)return{};var k=document.cookie||'',c=k.match(/(?:^|;\\s*)${CONSENT_COOKIE}=([^;]*)/),r=c?c[1].trim():'';if(r){var a;try{var p=JSON.parse(decodeURIComponent(r));a=!!(p&&p.analytics)}catch(e){a=r==='all'}if(!a)return{}}else if(!/(?:^|;\\s*)${CONSENT_REGION_COOKIE}=${CONSENT_REGION_UNRESTRICTED_VALUE}(?:;|$)/.test(k))return{};var m=JSON.parse(window.localStorage.getItem('${VISITOR_INTENT_STORAGE_KEY}')||'null'),o={};if(m&&typeof m.intent==='string'&&/^(${VISITOR_INTENTS.join('|')})$/.test(m.intent))o.visitor_intent=m.intent;if(m&&typeof m.primaryMarket==='string'&&/^[a-z0-9-]{1,${MARKET_SLUG_MAX}}$/.test(m.primaryMarket))o.primary_market=m.primaryMarket;return o}catch(e){return{}}})()`

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
  //
  // The first-paint page_view is pushed here, right after gtm.js (GTM version 9,
  // 2026-10-14): GTM's "GA4 - page_view" tag sends it with page_type, broker_slug
  // and an identity-stripped page_location, and the Google tag no longer sends
  // its own (send_page_view false). Pushing it inline, not from a React effect,
  // keeps a visitor who leaves before hydration counted, as the Google tag did.
  // PageViewTracker sends the later client-side navigations. The page_view also
  // carries the stored visitor_intent / primary_market (VISITOR_INTENT_JS), which
  // GTM version 10 sends as GA4 user properties.
  const safePageType = pageType.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return `window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
${consentModeDefaultJs()}
window.dataLayer.push({page_type:'${safePageType}'});
(function(){try{var a=new URLSearchParams(location.search||'').get('agent');if(!a){var m=document.cookie.match(/(?:^|; )rr_agent_attribution=([^;]*)/);if(m){try{var j=JSON.parse(decodeURIComponent(m[1]));a=j&&j.slug}catch(e){a=decodeURIComponent(m[1])}}}if(!a)return;a=String(a).trim().toLowerCase();var map={matt:'matt','matt-ryan':'matt',rebecca:'rebecca','rebecca-peterson':'rebecca',paul:'paul','paul-stevenson':'paul'};var s=map[a];if(!s)return;gtag('set','user_properties',{assigned_broker:s});window.dataLayer.push({broker_slug:s,assigned_broker:s})}catch(e){}})();
if(!${PRIVATE_PATH_JS}&&!${GA_SUPPRESS_JS})(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});w[l].push(Object.assign({event:'page_view',page_type:'${safePageType}',page_location:${GA4_PAGE_LOCATION_JS}},${VISITOR_INTENT_JS}));var f=d.getElementsByTagName(s)[0], // hydration-safe — GTM bootstrap stamp
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;if(f&&f.parentNode)f.parentNode.insertBefore(j,f);else d.head.appendChild(j);
})(window,document,'script','dataLayer','${gtmId}');`
}

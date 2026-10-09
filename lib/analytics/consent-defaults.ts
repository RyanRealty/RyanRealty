import { CONSENT_COOKIE } from '@/lib/identity/consent'
import { RESTRICTED_CONSENT_REGIONS } from './consent-regions'

/**
 * Inline JS for the ONE Consent Mode v2 default, before gtm.js / gtag.js.
 *
 * Pattern (Google: region-specific default wins; a default without `region`
 * covers everyone else):
 *   1. Restricted regions (shared list): analytics + all ad_* denied.
 *   2. Everywhere else: analytics_storage granted, ad_* denied.
 * GPC or a stored decline: a single all-denied default (no granted analytics).
 * A stored accept is applied here too so the first ping is not a denied ping.
 *
 * functionality_storage and security_storage are granted in every default:
 * with GTM present, PR #432 drops the late GoogleAnalytics default, so this
 * is the only source of those two.
 *
 * The navigator/document reads live in this static script text and run in the
 * browser via next/script, not during React render. Kept at module scope so
 * ci:hydration-safety does not treat the exported helper as an impure render
 * read (#418 / #437).
 */
const CONSENT_COOKIE_PREFIX = `${CONSENT_COOKIE}=`
const RESTRICTED_REGION_JSON = JSON.stringify([...RESTRICTED_CONSENT_REGIONS])
const CONSENT_MODE_DEFAULT_JS = `(function(){var gpc=false;try{gpc=navigator.globalPrivacyControl===true}catch(e){}var stored=null;try{var prefix='${CONSENT_COOKIE_PREFIX}';var rows=document.cookie.split('; ');var raw='';for(var i=0;i<rows.length;i++){if(rows[i].indexOf(prefix)===0){raw=rows[i].substring(prefix.length);break;}}if(raw){try{var p=JSON.parse(decodeURIComponent(raw));stored={a:!!p.analytics,m:!!p.marketing};}catch(e2){stored=raw==='all'?{a:true,m:true}:{a:false,m:false};}}}catch(e3){}var denied={ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500};if(gpc||(stored&&!stored.a)){gtag('consent','default',denied);return;}if(stored&&stored.a){gtag('consent','default',{ad_storage:stored.m?'granted':'denied',ad_user_data:stored.m?'granted':'denied',ad_personalization:stored.m?'granted':'denied',analytics_storage:'granted',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});return;}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500,region:${RESTRICTED_REGION_JSON}});gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});})();`

export function consentModeDefaultJs(): string {
  return CONSENT_MODE_DEFAULT_JS
}

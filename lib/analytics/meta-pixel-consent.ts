import { CONSENT_COOKIE, type ConsentState } from '@/lib/identity/consent'
import { CONSENT_REGION_COOKIE, CONSENT_REGION_UNRESTRICTED_VALUE } from './consent-regions'

/**
 * When the visitor has not answered the banner, is not in a restricted region,
 * and is not sending GPC: the Meta Pixel follows this flag.
 *
 * Matt 2026-10-08: `false` so the pixel stays off until marketing cookies are
 * accepted (same as ad_* denied). Flip to `true` to follow analytics_storage
 * instead (loads in the US with Limited Data Use until marketing is granted).
 * An ad click is not consent and never loads the pixel.
 */
export const META_PIXEL_DEFAULT_FOLLOWS_ANALYTICS_STORAGE = false

export function metaPixelMayLoad(args: {
  stored: ConsentState | null
  gpc: boolean
  restrictedRegion: boolean
}): boolean {
  if (args.gpc) return false
  if (args.stored && !args.stored.analytics && !args.stored.marketing) return false
  if (args.stored?.marketing) return true
  if (args.restrictedRegion) return false
  return META_PIXEL_DEFAULT_FOLLOWS_ANALYTICS_STORAGE
}

/**
 * Inline Meta Pixel bootstrap. Loads fbevents.js and inits only when allowed.
 * Does not set `_fbp` when denied (no init). LDU stays on when marketing is
 * not explicitly granted.
 *
 * navigator/window/document reads live in this static script text and run in
 * the browser via next/script, not during React render. The exported helper
 * only interpolates the escaped pixel id so ci:hydration-safety does not treat
 * it as an impure render read (#418 / #437).
 */
const META_PIXEL_FOLLOW_DEFAULT = META_PIXEL_DEFAULT_FOLLOWS_ANALYTICS_STORAGE ? 'true' : 'false'
const META_PIXEL_CONSENT_PREFIX = `${CONSENT_COOKIE}=`
const META_PIXEL_REGION_PREFIX = `${CONSENT_REGION_COOKIE}=`
const META_PIXEL_BOOTSTRAP_BEFORE_ID = `(function(){
  var gpc=false;try{gpc=navigator.globalPrivacyControl===true}catch(e){}
  var restricted=true;
  try{
    var rp='${META_PIXEL_REGION_PREFIX}';
    var rows=document.cookie.split('; ');
    for(var i=0;i<rows.length;i++){if(rows[i].indexOf(rp)===0){restricted=rows[i].substring(rp.length)!=='${CONSENT_REGION_UNRESTRICTED_VALUE}';break;}}
  }catch(e){}
  var stored=null;
  try{
    var cp='${META_PIXEL_CONSENT_PREFIX}';
    var rows2=document.cookie.split('; ');
    var raw='';
    for(var j=0;j<rows2.length;j++){if(rows2[j].indexOf(cp)===0){raw=rows2[j].substring(cp.length);break;}}
    if(raw){try{var p=JSON.parse(decodeURIComponent(raw));stored={analytics:!!p.analytics,marketing:!!p.marketing};}catch(e2){stored=raw==='all'?{analytics:true,marketing:true}:{analytics:false,marketing:false};}}
  }catch(e3){}
  var allow=false;
  if(gpc){allow=false;}
  else if(stored&&!stored.analytics&&!stored.marketing){allow=false;}
  else if(stored&&stored.marketing){allow=true;}
  else if(restricted){allow=false;}
  else{allow=${META_PIXEL_FOLLOW_DEFAULT};}
  if(!allow)return;
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  if(s&&s.parentNode)s.parentNode.insertBefore(t,s);else b.head.appendChild(t);}(window,document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  var marketing=!!(stored&&stored.marketing);
  if(!marketing){window.fbq('dataProcessingOptions',['LDU'],0,0);}else{window.fbq('dataProcessingOptions',[]);}
  window.fbq('consent','grant');
  window.fbq('init','`
const META_PIXEL_BOOTSTRAP_AFTER_ID = `');
  window.fbq('track','PageView');
})();`

export function metaPixelBootstrapScript(pixelId: string): string {
  const safeId = pixelId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return META_PIXEL_BOOTSTRAP_BEFORE_ID + safeId + META_PIXEL_BOOTSTRAP_AFTER_ID
}

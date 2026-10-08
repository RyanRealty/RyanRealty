import { CONSENT_COOKIE, isAdTrafficSearch, type ConsentState } from '@/lib/identity/consent'
import { CONSENT_REGION_COOKIE, CONSENT_REGION_UNRESTRICTED_VALUE } from './consent-regions'

/**
 * When the visitor has not answered the banner, is not in a restricted region,
 * and is not sending GPC: the Meta Pixel follows analytics_storage (loads).
 *
 * Counsel: flip this to `false` to follow the ad_* denied default instead
 * (pixel loads only after an explicit marketing grant, or the US campaign-link
 * grant). One-line change. Ad-click auto-grant never applies in a restricted
 * or unknown region.
 */
export const META_PIXEL_DEFAULT_FOLLOWS_ANALYTICS_STORAGE = true

export function metaPixelMayLoad(args: {
  stored: ConsentState | null
  gpc: boolean
  restrictedRegion: boolean
  search?: string | null
}): boolean {
  if (args.gpc) return false
  if (args.stored && !args.stored.analytics && !args.stored.marketing) return false
  if (args.stored?.marketing) return true
  if (args.restrictedRegion) return false
  if (args.stored === null && isAdTrafficSearch(args.search)) return true
  return META_PIXEL_DEFAULT_FOLLOWS_ANALYTICS_STORAGE
}

/**
 * Inline Meta Pixel bootstrap. Loads fbevents.js and inits only when allowed.
 * Does not set `_fbp` when denied (no init). LDU stays on when marketing is
 * not explicitly granted (except the campaign-link grant, same as today).
 */
export function metaPixelBootstrapScript(pixelId: string): string {
  const safeId = pixelId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const follow = META_PIXEL_DEFAULT_FOLLOWS_ANALYTICS_STORAGE ? 'true' : 'false'
  const consentPrefix = `${CONSENT_COOKIE}=`
  const regionPrefix = `${CONSENT_REGION_COOKIE}=`
  return `(function(){
  var gpc=false;try{gpc=navigator.globalPrivacyControl===true}catch(e){}
  var restricted=true;
  try{
    var rp='${regionPrefix}';
    var rows=document.cookie.split('; ');
    for(var i=0;i<rows.length;i++){if(rows[i].indexOf(rp)===0){restricted=rows[i].substring(rp.length)!=='${CONSENT_REGION_UNRESTRICTED_VALUE}';break;}}
  }catch(e){}
  var stored=null;
  try{
    var cp='${consentPrefix}';
    var rows2=document.cookie.split('; ');
    var raw='';
    for(var j=0;j<rows2.length;j++){if(rows2[j].indexOf(cp)===0){raw=rows2[j].substring(cp.length);break;}}
    if(raw){try{var p=JSON.parse(decodeURIComponent(raw));stored={analytics:!!p.analytics,marketing:!!p.marketing};}catch(e2){stored=raw==='all'?{analytics:true,marketing:true}:{analytics:false,marketing:false};}}
  }catch(e3){}
  var search='';try{search=window.location.search||'';}catch(e4){}
  var ad=false;
  try{
    var qs=new URLSearchParams(search);
    ad=qs.has('fbclid')||qs.has('gclid')||qs.has('msclkid')||qs.has('ttclid');
    if(!ad){var keys=Array.from(qs.keys());for(var k=0;k<keys.length;k++){if(keys[k].toLowerCase().indexOf('utm_')===0){ad=true;break;}}}
  }catch(e5){}
  var allow=false;
  if(gpc){allow=false;}
  else if(stored&&!stored.analytics&&!stored.marketing){allow=false;}
  else if(stored&&stored.marketing){allow=true;}
  else if(restricted){allow=false;}
  else if(stored===null&&ad){allow=true;}
  else{allow=${follow};}
  if(!allow)return;
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  if(s&&s.parentNode)s.parentNode.insertBefore(t,s);else b.head.appendChild(t);}(window,document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  var marketing=!!(stored&&stored.marketing)||(stored===null&&ad);
  if(!marketing){window.fbq('dataProcessingOptions',['LDU'],0,0);}else{window.fbq('dataProcessingOptions',[]);}
  window.fbq('consent','grant');
  window.fbq('init','${safeId}');
  window.fbq('track','PageView');
})();`
}

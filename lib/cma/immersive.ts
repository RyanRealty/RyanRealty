/**
 * Immersive CMA — same data as the print artifact, same chapter order.
 * Price first, then why, rivals, three sales with tap-pin, subdivision,
 * wider-market charts.
 */

import type { RenderCmaArgs } from '@/lib/cma/render'
import type { CmaBroker } from '@/lib/cma/types'
import { immersiveAnswerHtml, immersiveHeroNumberHtml } from '@/lib/cma/cover-value'
import { inboundImmersiveHeroKick, inboundImmersiveTitle } from '@/lib/cma/inbound-packet'
import { formatClientMlsField } from '@/lib/cma/client-facing'
import { cleanText } from '@/lib/cma/render-blocks'
import { immersiveStylesheet } from '@/lib/cma/immersive-css'
import { assembleOpinionScenes } from '@/lib/cma/opinion-scenes'
import { renderCompPinMapScript } from '@/lib/cma/comp-pin-map'

type ImmersiveArgs = RenderCmaArgs & { broker: CmaBroker }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function renderImmersiveCmaHtml(a: ImmersiveArgs, siteUrl: string): string {
  const s = a.subject
  const heroImg = s.photoUrl ? `<img class="hero-img" src="${esc(s.photoUrl)}" alt="" aria-hidden="true"/>` : ''
  const view = formatClientMlsField(s.viewDescription)
  const specs = [
    s.beds != null ? `${s.beds} bed` : null,
    s.baths != null ? `${s.baths} bath` : null,
    s.sqft != null ? `${s.sqft.toLocaleString('en-US')} sqft` : null,
    s.yearBuilt != null ? `built ${s.yearBuilt}` : null,
    view,
  ]
    .filter(Boolean)
    .join(' · ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>${esc(inboundImmersiveTitle(s.streetAddress))}</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
@font-face{font-family:'Amboqia Boriango';src:url('${siteUrl}/fonts/Amboqia_Boriango.otf') format('opentype');font-display:swap}
${immersiveStylesheet()}
</style>
</head>
<body>
<div id="bar"><div class="bt">${esc(s.streetAddress)} · ${esc(s.city)}, OR</div><a href="?print=1">Print report</a><div id="prog"></div></div>

<section class="sc hero on" id="top">
  ${heroImg}
  <div class="hero-scrim" aria-hidden="true"></div>
  <div class="in">
    <div class="hero-kick">${esc(inboundImmersiveHeroKick(s.streetAddress, a.generatedAtIso))}</div>
    <h1 class="hero-h">${esc(s.streetAddress)}</h1>
    <div class="hero-sub">${esc(s.city)}, ${esc(s.state)} ${esc(s.postalCode ?? '')}${cleanText(s.subdivision) ? ` · ${esc(cleanText(s.subdivision)!)}` : ''}${specs ? ` · ${esc(specs)}` : ''}</div>
    <div class="hero-for">Prepared for ${esc(a.client.name ?? 'the owner')} by ${esc(a.broker.displayName)}, Ryan Realty</div>
    ${immersiveHeroNumberHtml(a)}
  </div>
  <div class="cue" aria-hidden="true"></div>
</section>

<section class="sc sc-cream" id="answer">
  <div class="in">
    <div class="kick r">The list</div>
    ${immersiveAnswerHtml(a)}
  </div>
</section>

${assembleOpinionScenes(a)}

<script>
(function(){
  try{
    var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches
    var bar=document.getElementById('bar'),prog=document.getElementById('prog')
    function onScroll(){
      var max=document.documentElement.scrollHeight-window.innerHeight
      var y=window.scrollY||0
      bar.classList.toggle('on',y>window.innerHeight*0.7)
      prog.style.width=(max>0?Math.min(100,y/max*100):0)+'%'
    }
    window.addEventListener('scroll',onScroll,{passive:true});onScroll()
    if(reduced||!('IntersectionObserver'in window))return
    document.documentElement.classList.add('anim')
    var scenes=[].slice.call(document.querySelectorAll('.sc'))
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target)}})},{rootMargin:'0px 0px -12% 0px'})
    scenes.forEach(function(s){io.observe(s)})
    setTimeout(function(){scenes.forEach(function(s){s.classList.add('on')})},4500)
    var live=[]
    function snap(){live.forEach(function(a){a.done=true;a.el.textContent=a.f});live=[]}
    window.addEventListener('beforeprint',snap)
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')snap()})
    var cio=new IntersectionObserver(function(es){es.forEach(function(e){
      if(!e.isIntersecting)return;cio.unobserve(e.target)
      var el=e.target,f=el.textContent
      var m=/^([^0-9]*)([\\d,]+(?:\\.\\d+)?)(.*)$/.exec(f.trim());if(!m)return
      var t=parseFloat(m[2].replace(/,/g,''));if(!isFinite(t)||t===0)return
      var dcs=(m[2].split('.')[1]||'').length,a={el:el,f:f,done:false};live.push(a)
      var t0=null
      function fr(ts){if(a.done)return;if(t0==null)t0=ts
        var pp=Math.min(1,(ts-t0)/900),ea=1-Math.pow(1-pp,3),v=t*ea
        el.textContent=m[1]+(dcs>0?v.toFixed(dcs):Math.round(v).toLocaleString('en-US'))+m[3]
        if(pp<1)requestAnimationFrame(fr);else{a.done=true;el.textContent=a.f;live=live.filter(function(x){return x!==a})}}
      requestAnimationFrame(fr)
    })},{rootMargin:'0px 0px -10% 0px'})
    ;[].slice.call(document.querySelectorAll('[data-count]')).forEach(function(el){cio.observe(el)})
  }catch(e){}
})();
${renderCompPinMapScript()}
</script>
</body>
</html>`
}

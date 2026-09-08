/**
 * Immersive CMA — same data as the print artifact, same chapter order.
 * Price first, then why, rivals, three sales with tap-pin, subdivision,
 * wider-market charts.
 */

import type { RenderCmaArgs } from '@/lib/cma/render'
import type { CmaBroker } from '@/lib/cma/types'
import { immersiveHeroNumberHtml } from '@/lib/cma/cover-value'
import { inboundImmersiveHeroKick, inboundImmersiveTitle } from '@/lib/cma/inbound-packet'
import { cleanText, dateLong } from '@/lib/cma/render-blocks'
import { immersiveStylesheet } from '@/lib/cma/immersive-css'
import { assembleOpinionScenes } from '@/lib/cma/opinion-scenes'
import { renderCompPinMapScript } from '@/lib/cma/comp-pin-map'

type ImmersiveArgs = RenderCmaArgs & { broker: CmaBroker }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function renderImmersiveCmaHtml(a: ImmersiveArgs, siteUrl: string): string {
  const s = a.subject
  // F3, Matt 2026-09-07: object-fit:cover cropped the MLS photo to the
  // viewport, and on 2465 7th that photo is an agent-annotated aerial — the
  // landmark callouts ran off both edges and the "*Location is approximate"
  // caption was cut in half, at 1280 and at 375. Nothing inside a photo we
  // publish gets cut, and we cannot know from the URL whether a photo carries
  // type. So the photo is CONTAINED, and a blurred copy of itself fills the
  // frame behind it: full-bleed to look at, complete to read.
  const heroImg = s.photoUrl
    ? `<img class="hero-bed" src="${esc(s.photoUrl)}" alt="" aria-hidden="true"/><img class="hero-img" src="${esc(s.photoUrl)}" alt="" aria-hidden="true"/>`
    : ''

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
    <div class="hero-sub">${esc(s.city)}, ${esc(s.state)} ${esc(s.postalCode ?? '')}${cleanText(s.subdivision) ? ` · ${esc(cleanText(s.subdivision)!)}` : ''}</div>
    <div class="hero-for">Prepared for ${esc(a.client.name ?? 'the owner')} by ${esc(a.broker.displayName)}, Ryan Realty · ${esc(
      dateLong(a.generatedAtIso),
    )}</div>
    ${immersiveHeroNumberHtml(a)}
  </div>
  <div class="cue" aria-hidden="true"></div>
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
    // Entrance reveal only. The count-up that used to run here animated §0
    // figures from zero, so a screenshot or a scroll-past caught 184 / 5.1% /
    // 0.7% where the document says 3,394 / 94.2% / 12.3% (F4, Matt
    // 2026-09-07). A number a seller can screenshot wrong does not animate.
    var scenes=[].slice.call(document.querySelectorAll('.sc'))
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target)}})},{rootMargin:'0px 0px -12% 0px'})
    scenes.forEach(function(s){io.observe(s)})
    setTimeout(function(){scenes.forEach(function(s){s.classList.add('on')})},4500)
  }catch(e){}
})();
${renderCompPinMapScript()}
</script>
</body>
</html>`
}

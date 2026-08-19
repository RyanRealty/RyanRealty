import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const b64=p=>readFileSync(p).toString('base64')
const G='node_modules/geist/dist/fonts/geist-sans'
const faces=[['Regular',400],['SemiBold',600]].map(([f,w])=>`@font-face{font-family:'Geist';src:url(data:font/woff2;base64,${b64(`${G}/Geist-${f}.woff2`)}) format('woff2');font-weight:${w};font-display:swap}`).join('\n')
const amb=`@font-face{font-family:'Amboqia';src:url(data:font/otf;base64,${b64('design_system/ryan-realty/fonts/Amboqia_Boriango.otf')}) format('opentype');font-display:swap}`
const FAMS=[['time','Time'],['rank','Rank'],['whole','Whole'],['relate','Relate'],['instrument','Board']]
const frags=FAMS.filter(([f])=>existsSync(`out/catalog/${f}.fragment.html`))
const body=frags.map(([f])=>readFileSync(`out/catalog/${f}.fragment.html`,'utf8')).join('\n')
const html=`<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Chart Room</title>
<style>${amb}\n${faces}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(120% 80% at 50% 0%,#12294a 0%,#0b1830 60%,#070f1f 100%);color:#faf8f4;font-family:'Geist',system-ui,sans-serif;min-height:100vh}
.hd{max-width:1140px;margin:0 auto;padding:26px 18px 6px}
h1{font-family:'Amboqia',Georgia,serif;font-weight:400;font-size:clamp(36px,7vw,58px);line-height:.93;letter-spacing:-.012em}
.sub{color:rgba(250,248,244,.5);font-size:12.5px;margin-top:7px}
nav{position:sticky;top:0;z-index:20;background:rgba(11,24,48,.82);backdrop-filter:blur(14px);border-bottom:1px solid rgba(250,248,244,.08)}
.seg{max-width:1140px;margin:0 auto;padding:10px 18px;display:flex}
.track{position:relative;display:flex;background:rgba(250,248,244,.07);border:1px solid rgba(250,248,244,.12);border-radius:999px;padding:3px;gap:0}
.track button{position:relative;z-index:2;font:600 12px 'Geist';letter-spacing:.06em;padding:8px 18px;border:0;background:none;color:rgba(250,248,244,.6);cursor:pointer;border-radius:999px;transition:color .2s}
.track button.on{color:#102742}
.ind{position:absolute;top:3px;bottom:3px;background:#faf8f4;border-radius:999px;transition:left .25s cubic-bezier(.4,0,.2,1),width .25s cubic-bezier(.4,0,.2,1);z-index:1}
main{max-width:1140px;margin:0 auto;padding:10px 18px 70px}
section.fam{position:absolute;left:-200vw;top:0;width:100%;visibility:hidden}section.fam.on{position:static;visibility:visible}
main{position:relative}
.card,.fam>div,.fam article{background:rgba(250,248,244,.03);border:1px solid rgba(250,248,244,.10);border-radius:16px;padding:18px 16px 10px;margin-top:18px}
h3.ct{font-family:'Amboqia',Georgia,serif;font-weight:400;font-size:clamp(20px,3.2vw,26px);letter-spacing:-.01em;margin-bottom:8px}
details.srcd{margin:8px 0 4px}
details.srcd summary{list-style:none;cursor:pointer;display:inline-block;font:600 9.5px 'Geist';letter-spacing:.13em;text-transform:uppercase;color:rgba(250,248,244,.38);border-bottom:1px dotted currentColor}
details.srcd summary::-webkit-details-marker{display:none}
details.srcd p{margin-top:6px;font-size:11px;color:rgba(250,248,244,.5);line-height:1.6;max-width:76ch}
.foot{max-width:1140px;margin:14px auto 0;padding:0 18px;font-size:10.5px;color:rgba(250,248,244,.4)}
</style>
<div class="hd"><h1>The chart room.</h1><p class="sub">Every form our data honestly supports · touch anything · keep or kill per chart</p></div>
<nav><div class="seg"><div class="track" id="tk">${frags.map(([f,l],i)=>`<button data-f="${f}"${i?'':' class="on"'}>${l}</button>`).join('')}<div class="ind" id="ind"></div></div></div></nav>
<main>${body}</main>
<p class="foot">Every figure from the statistics engine and pricing warehouse · medians computed in the database · no interpolation, no forecast.</p>
<script>
(function(){const tk=document.getElementById('tk'),ind=document.getElementById('ind')
function crShow(f,btn){document.querySelectorAll('section.fam').forEach(s=>s.classList.toggle('on',s.id==='fam-'+f))
 tk.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===btn))
 ind.style.left=btn.offsetLeft+'px';ind.style.width=btn.offsetWidth+'px'
}
tk.querySelectorAll('button').forEach(b=>b.onclick=()=>crShow(b.dataset.f,b))
requestAnimationFrame(()=>{const b=tk.querySelector('button');crShow(b.dataset.f,b)})})()
</script>`
writeFileSync('out/chart-room.html',html)
console.log('assembled',frags.map(([f])=>f).join('+'),'→',Math.round(html.length/1024),'KB')

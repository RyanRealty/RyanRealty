import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport:{width:1440,height:1000}, userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36', reducedMotion:'reduce' })
const out=[]
for (const [path,name] of [['/cities/bend','bend-city-control'],['/housing-market/central-oregon','region-control']]) {
  const p = await ctx.newPage()
  try {
    await p.goto('http://localhost:3110'+path, { waitUntil:'domcontentloaded', timeout:300000 })
    await p.waitForTimeout(8000)
    await p.addStyleTag({content:`*,*::before,*::after{animation:none!important;transition:none!important}`})
    await p.evaluate(()=>{const s=document.getElementById('market-report'); if(s) s.scrollIntoView({block:'start'})})
    await p.waitForTimeout(2500)
    const sec = await p.$('#market-report')
    if (sec) await sec.screenshot({path:`/tmp/mos-shots/${name}-market.png`})
    out.push({ path, ...await p.evaluate(()=>{
      const t=document.body.innerText
      const scripts=[...document.querySelectorAll('script[type="application/ld+json"]')]
      const ld=scripts.map(s=>s.textContent).join('\n')
      const vars=[]
      for(const r of scripts){try{const j=JSON.parse(r.textContent);for(const n of (Array.isArray(j)?j:[j]))for(const g of (n['@graph']||[n]))if(g.variableMeasured)for(const v of g.variableMeasured)vars.push(`${v.name}=${v.value}`)}catch(e){}}
      return { verdicts:t.match(/buyer.s market|seller.s market|balanced market/gi)||[], mos:t.match(/\d+(\.\d+)?\s*mo\b/gi)||[], jsonld_MoS:/Months of Supply/.test(ld), datasetVars:vars.slice(0,8), methodology:((document.querySelector('.mkt-fine')||{}).innerText||'').slice(0,200) }
    })})
  } catch(e){ out.push({path, error:String(e).slice(0,120)}) }
  await p.close()
}
await b.close(); console.log(JSON.stringify(out,null,1))

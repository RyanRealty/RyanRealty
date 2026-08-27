import { config } from 'dotenv'
config({ path: '.env.local' })
import Module from 'node:module'
const o=(Module as any)._load;(Module as any)._load=function(r:string,p:unknown,m:boolean){return r==='server-only'?{}:o.call(this,r,p,m)}

const SUBJECTS = [
  { slug: 'qa-tumalo-reservoir-19496', mlsNumber: null, rawAddress: '19496 Tumalo Reservoir Rd', city: 'Bend', postalCode: '97703', label: 'RURAL ACREAGE — 19496 Tumalo Reservoir' },
  { slug: 'qa-plaza-363-bluff',        mlsNumber: '20260729182950045248000000', rawAddress: null, city: 'Bend', postalCode: '97702', label: 'CONDO — The Plaza, 363 Bluff' },
  { slug: 'qa-florida-828',            mlsNumber: '20260805071518931426000000', rawAddress: null, city: 'Bend', postalCode: '97703', label: 'WESTSIDE SFR — 828 Florida' },
]

async function main(){
  const { buildCma } = await import('./lib/cma/build')
  for (const s of SUBJECTS){
    console.log(`\n########## ${s.label} ##########`)
    const t0 = Date.now()
    const res: any = await buildCma({
      slug: s.slug,
      mlsNumber: s.mlsNumber,
      rawAddress: s.rawAddress,
      city: s.city,
      postalCode: s.postalCode,
      client: { name: 'Internal QA', email: null, phone: null, notes: 'Quality review build — not for delivery' },
      brokerSlug: 'matt',
      requestSource: 'internal-qa',
      docType: 'cma',
    })
    console.log(`  ok=${res.ok} in ${((Date.now()-t0)/1000).toFixed(0)}s${res.error?`  error=${String(res.error).slice(0,140)}`:''}`)
  }
}
main().catch(e=>{console.error('FATAL', e?.message ?? e); process.exit(1)})

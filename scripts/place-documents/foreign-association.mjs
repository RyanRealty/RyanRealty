#!/usr/bin/env node
/**
 * Catch the one failure the token scan misses: a document whose title names a
 * DIFFERENT association than the plat it is filed under.
 *
 * Generic subject extraction was tried and abandoned — recorded titles vary too
 * much ("PROTECTIVE COVENANTS, CONDITIONS, RESTRICTIONS AND EASEMENTS FOR …"
 * puts the subject far from the anchor), so it produced 328 false flags. This
 * is deliberately narrow instead: find an explicit "<NAME> OWNERS ASSOCIATION"
 * in the front matter, and flag ONLY when that name shares no distinctive word
 * with the plat. High precision, low recall, which is the right trade when the
 * consequence of a false flag is hiding a real CC&R.
 *
 * The case it exists for: Crooked Horseshoe Homeowner's Association declarations
 * filed under Indian Ford Meadows.
 */
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')

// ASSOC\w{0,10} rather than the literal word: OCR of microfilm turns
// "ASSOCIATION" into "ASSOCIALION", "ASSOCIALION" and "ASSOCIATIOA", and an
// exact anchor silently missed a Crooked Horseshoe declaration that was sitting
// published on the Indian Ford Meadows page.
const ASSOC_RE = /\b([A-Z][A-Z0-9'’\-\.]*(?:\s+[A-Z][A-Z0-9'’\-\.]*){0,3})\s+(?:HOME\s*OWNERS?|HOMEOWNERS?|OWNERS?|PROPERTY\s+OWNERS?)['’]?S?\s+ASSOC\w{0,10}/g

const NOISE = new Set(['the','of','a','an','at','and','to','in','for','on','subdivision','phase','unit','no','number','addition','section','tract','tracts','condominium','condominiums','condo','condos','homesites','homesite','estates','estate','first','second','third','inc','incorporated','association','property','oregon','non','profit','corporation','plat','declaration','declarations','covenants','conditions','restrictions','protective','amended','restated','bylaws','laws','articles','this','that','said','real','land','lots','lot'])
const words = (s) => String(s||'').toUpperCase().replace(/[^A-Z0-9 ]+/g,' ').split(/\s+/).filter(t=>t.length>=4 && !NOISE.has(t.toLowerCase()))
function fuzzyIn(hay,tok){for(let i=0;i+tok.length<=hay.length;i++){let d=0;for(let j=0;j<tok.length;j++)if(hay[i+j]!==tok[j]){if(++d>1)break}if(d<=1)return true}return false}

const rows=[]
for(let last='00000000-0000-0000-0000-000000000000';;){
  const {data,error}=await sb.from('place_document')
    .select('id, published_name, recording_ref, doc_kind, ocr_text, name_confirmed')
    .gt('id',last).order('id',{ascending:true}).limit(500)
  if(error) throw new Error(error.message)
  if(!data.length) break
  rows.push(...data); last=data[data.length-1].id
  if(data.length<500) break
}
console.error(`${rows.length} documents`)

const flags=[]
for(const r of rows){
  if(r.name_confirmed !== true) continue
  const head=(r.ocr_text||'').replace(/<<<PAGE \d+>>>/g,' ').replace(/\s+/g,' ').slice(0,1800).toUpperCase()
  const platTokens=words(r.published_name)
  if(!platTokens.length) continue
  const found=new Set()
  let m
  ASSOC_RE.lastIndex=0
  while((m=ASSOC_RE.exec(head))){ const nm=m[1].trim(); if(nm.length>3) found.add(nm) }
  if(!found.size) continue
  // If ANY association named in the front matter matches the plat, the document
  // is about this place — no flag, regardless of what else is mentioned.
  let anyMatch=false
  for(const nm of found){
    const hay=nm.replace(/[^A-Z0-9 ]+/g,' ').replace(/\s+/g,' ')
    if(platTokens.every(t=>hay.includes(t)||fuzzyIn(hay,t))) { anyMatch=true; break }
  }
  if(anyMatch) continue
  // Filter OCR garbage and same-place-said-differently before flagging.
  const real=[...found].filter(nm=>{
    const t=words(nm)
    // A real association name carries at least two distinctive words. This
    // discards OCR debris like "OP. THE", "NOTICE OF", "OWNERS OR TO AN".
    if(t.length<2) return false
    // Reverse check: if the extracted name's words all appear in the PLAT name,
    // it is this place under a longer or garbled spelling, not a foreign entity.
    // Kills "SUMMIT AT BROKEN TOP" under "Skyliner Summit at Broken Top" and
    // "D. PARCH ESTATES" under "J-D Ranch Estates".
    const platHay=r.published_name.toUpperCase().replace(/[^A-Z0-9 ]+/g,' ').replace(/\s+/g,' ')
    if(t.every(x=>platHay.includes(x)||fuzzyIn(platHay,x))) return false
    return true
  })
  if(!real.length) continue
  flags.push({id:r.id,name:r.published_name,ref:r.recording_ref,kind:r.doc_kind,assoc:real.slice(0,2).join(' / ')})
}

console.error(`\nname_confirmed=true but every association named in the front matter is foreign: ${flags.length}`)
for(const f of flags.slice(0,30)) console.error(`   "${f.name}" (${f.ref}) [${f.kind}] -> names only "${f.assoc}"`)

if(!APPLY){ console.error('\n(dry run — pass --apply)'); process.exit(0) }
let n=0
for(const f of flags){ const {error}=await sb.from('place_document').update({name_confirmed:false}).eq('id',f.id); if(!error) n++ }
console.error(`\nflipped ${n}`)

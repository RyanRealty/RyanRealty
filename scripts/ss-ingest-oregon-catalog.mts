import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const env: Record<string, string> = {}
for (const ln of readFileSync('.env.local', 'utf8').split('\n')) {
  const i = ln.indexOf('=')
  if (i < 1 || ln.startsWith('#')) continue
  env[ln.slice(0, i)] = ln.slice(i + 1).replace(/^["']|["']$/g, '')
}
const SECRET = env.TC_FORMS_INGEST_SECRET
const INGEST = 'https://ryan-realty.com/api/admin/forms/ingest'

type Row = {
  id: number
  formId: number
  libraryId: number
  code: string
  name: string
  pageCount: number | null
  previewUrl: string
}

const forms = JSON.parse(readFileSync('tmp/ss-cat-0.json', 'utf8')) as Row[]
const names: Record<string, string> = { OREF: 'OREF', ODS: 'Oregon Data Share', OR: 'Oregon Realtors' }

function parseNum(name: string): string | null {
  const oref = name.match(/\bOREF[- ]?(\d{3}[A-Z]?)\b/i)
  if (oref) return oref[1].toUpperCase()
  const lead = name.match(/^(\d{3}[A-Z]?)\b/)
  return lead ? lead[1].toUpperCase() : null
}

let ok = 0
let fail = 0
for (const f of forms) {
  try {
    const pdfRes = await fetch(f.previewUrl)
    if (!pdfRes.ok) throw new Error(`pdf ${pdfRes.status}`)
    const buf = Buffer.from(await pdfRes.arrayBuffer())
    if (buf.byteLength < 500) throw new Error(`tiny pdf ${buf.byteLength}`)
    const b64 = buf.toString('base64')
    const ingest = await fetch(INGEST, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({
        libraryCode: f.code,
        libraryName: names[f.code] ?? f.code,
        region: 'US-OR',
        formNumber: parseNum(f.name),
        name: f.name,
        sourceFormId: String(f.formId),
        sourceVersionId: String(f.id),
        pageCount: f.pageCount,
        pdfBase64: b64,
      }),
    })
    const text = await ingest.text()
    if (!ingest.ok) throw new Error(`ingest ${ingest.status} ${text.slice(0, 160)}`)
    ok++
    if (ok % 20 === 0) console.log('ok', ok, f.code, f.name.slice(0, 40))
  } catch (e) {
    fail++
    console.log('fail', f.code, f.id, f.name.slice(0, 40), String(e).slice(0, 180))
  }
}
console.log({ ok, fail, total: forms.length, shaHint: createHash('sha1').update(String(ok)).digest('hex').slice(0, 8) })

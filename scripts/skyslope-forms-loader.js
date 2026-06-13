/*
 * SkySlope Forms loader — paste into the DevTools console of the AUTHED
 * SkySlope Forms tab (Chrome "mac mini matt logged in"), handoff
 * docs/TC_FORMS_LOADING_HANDOFF.md §4 Step 3.
 *
 * Pulls current-published OREF/ODS/OR blanks + field metadata and POSTs them to
 * our ingest endpoint. The SkySlope JWT never leaves the browser. Returns counts
 * only (token-free, so the privacy filter does not blank the result).
 *
 * SET THIS before running:
 */
const SECRET = 'PASTE_TC_FORMS_INGEST_SECRET_HERE'

// Smoke first (handoff §4 Step 4): set SMOKE=true to load just 3 forms, verify
// in Supabase + the composer, THEN set SMOKE=false for the full pull.
const SMOKE = true
const SMOKE_VERSION_IDS = [117038] // OREF PSA + add 2 more ids after a peek

const BASE = 'https://forms.skyslope.com/library/api'
const INGEST = 'https://ryan-realty.com/api/admin/forms/ingest'
const LIBS = [
  { code: 'OR', name: 'Oregon Realtors', id: 1837 },
  { code: 'ODS', name: 'Oregon Data Share', id: 1528 },
  { code: 'OREF', name: 'OREF', id: 1340 },
]

;(async () => {
  const tok = JSON.parse(sessionStorage['com.skyslope.id.tokens']).accessToken.accessToken
  const H = { authorization: 'Bearer ' + tok, 'api-version': '2.0', accept: 'application/json' }
  const progress = JSON.parse(localStorage.getItem('rr_forms_progress') || '{"done":[],"ok":0,"fail":0}')
  const done = new Set(progress.done)

  const blobToB64 = (blob) =>
    new Promise((res) => {
      const r = new FileReader()
      r.onloadend = () => res(String(r.result).split(',')[1])
      r.readAsDataURL(blob)
    })
  const parseNum = (n) => (String(n).match(/\b\d{2,4}\b/) || [null])[0]
  const parseVer = (n) => (String(n).match(/\b(rev|v|ed)\.?\s*[\w/.-]+/i) || [null])[0]

  for (const lib of LIBS) {
    const listRes = await fetch(`${BASE}/form-versions?libraryId=${lib.id}&api-version=2.0`, { credentials: 'include', headers: H })
    const list = (await listRes.json()).result.formVersionViewModels || []
    let current = list.filter((v) => v.status === 'Published' && v.id === v.publishedVersionId)
    if (SMOKE) current = current.filter((v) => SMOKE_VERSION_IDS.includes(v.id))

    for (const v of current) {
      if (done.has(v.id)) continue
      try {
        const pdf = await (await fetch(`${BASE}/form-versions/${v.id}/download?api-version=2.0`, { credentials: 'include', headers: H })).blob()
        const detail = (await (await fetch(`${BASE}/form-versions/${v.id}?api-version=2.0`, { credentials: 'include', headers: H })).json()).result
        const b64 = await blobToB64(pdf)
        const res = await fetch(INGEST, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + SECRET },
          body: JSON.stringify({
            libraryCode: lib.code,
            libraryName: lib.name,
            region: 'US-OR',
            formNumber: parseNum(v.name),
            name: v.name,
            sourceFormId: String(v.formId),
            sourceVersionId: String(v.id),
            versionLabel: parseVer(v.name),
            status: v.status,
            pageCount: v.pageCount,
            pdfBase64: b64,
            sourceFields: { fields: detail.fields, pages: detail.pages },
          }),
        })
        if (res.ok) { progress.ok++; done.add(v.id) } else { progress.fail++; console.warn('ingest failed', lib.code, v.id, res.status) }
      } catch (e) {
        progress.fail++
        console.warn('error', lib.code, v.id, String(e))
      }
      progress.done = [...done]
      localStorage.setItem('rr_forms_progress', JSON.stringify(progress))
    }
  }
  // token-free summary only
  console.log('DONE', { ok: progress.ok, fail: progress.fail, loaded: progress.done.length })
})()

/**
 * In-page SkySlope Forms console script. Lists current published versions for
 * OREF / ODS / Oregon Realtors and copies JSON. No PDF download. No token
 * leaves the SkySlope tab. Paste the JSON on /admin/forms.
 */

import { OREGON_FORM_LIBRARIES } from './form-catalog-diff'

export function buildFormCatalogCheckScript(): string {
  const libs = OREGON_FORM_LIBRARIES.map((l) => ({
    libraryCode: l.code,
    sourceLibraryId: l.sourceLibraryId,
  }))
  return `;(async () => {
  const raw = sessionStorage['com.skyslope.id.tokens'];
  if (!raw) { alert('Open SkySlope Forms while signed in, then run this again.'); return; }
  const tok = JSON.parse(raw).accessToken.accessToken;
  if (typeof tok !== 'string' || tok.length < 20) { alert('SkySlope Forms token is missing. Click a form once, then retry.'); return; }
  const H = { authorization: 'Bearer ' + tok, 'api-version': '2.0', accept: 'application/json' };
  const base = 'https://forms.skyslope.com/library/api';
  const libs = ${JSON.stringify(libs)};
  function parseNum(name) {
    const text = String(name || '').trim();
    const orefPrefix = text.match(/\\bOREF[- ](\\d{3}[A-Z]?)\\b/i);
    if (orefPrefix) return orefPrefix[1].toUpperCase();
    const orefSuffix = text.match(/\\b(\\d{3}[A-Z]?)\\s*[-–]?\\s*OREF\\b/i);
    if (orefSuffix) return orefSuffix[1].toUpperCase();
    const orNum = text.match(/^(\\d{1,2}\\.\\d+[A-Z]?)\\b/i);
    if (orNum) return orNum[1].toUpperCase();
    const lead = text.match(/^(\\d{3}[A-Z]?)\\b/);
    return lead ? lead[1].toUpperCase() : null;
  }
  function parseVer(name) {
    const dated = String(name || '').match(/\\((\\d{1,2}\\/\\d{4})\\)/);
    if (dated) return dated[1];
    const rev = String(name || '').match(/\\bRev\\.?\\s*([\\d.]+)/i);
    if (rev) return rev[1];
    const ymd = String(name || '').match(/\\b(20\\d{2}-\\d{2})\\b/);
    return ymd ? ymd[1] : null;
  }
  const res = await fetch(base + '/form-versions?api-version=2.0', { credentials: 'include', headers: H });
  if (!res.ok) { alert('SkySlope list failed (' + res.status + ').'); return; }
  const json = await res.json();
  const all = (json.result && json.result.formVersionViewModels) || [];
  const wanted = {};
  for (const lib of libs) wanted[String(lib.sourceLibraryId)] = lib;
  const grouped = {};
  for (const lib of libs) grouped[lib.libraryCode] = [];
  for (const v of all) {
    const lib = wanted[String(v.libraryId)];
    if (!lib) continue;
    if (v.status !== 'Published' || v.id !== v.publishedVersionId) continue;
    grouped[lib.libraryCode].push({
      sourceFormId: String(v.formId),
      sourceVersionId: String(v.id),
      name: v.name,
      formNumber: parseNum(v.name),
      pageCount: v.pageCount == null ? null : v.pageCount,
      versionLabel: parseVer(v.name),
      previewUrl: v.previewUrl || null
    });
  }
  const out = { checkedAt: new Date().toISOString(), libraries: [] };
  for (const lib of libs) {
    const forms = grouped[lib.libraryCode] || [];
    if (!forms.length) { alert('SkySlope returned no published forms for ' + lib.libraryCode + '.'); return; }
    out.libraries.push({
      libraryCode: lib.libraryCode,
      sourceLibraryId: String(lib.sourceLibraryId),
      forms: forms
    });
  }
  const text = JSON.stringify(out);
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = 'form-catalog.json';
    a.click();
  }
  alert('Catalog ready: ' + out.libraries.map(function (l) { return l.libraryCode + ' ' + l.forms.length; }).join(', ') + '. Paste it on /admin/forms. Apply pulls new and updated blanks.');
})();`
}

export const FORM_CATALOG_SCRIPT_RULES = {
  origin: 'https://forms.skyslope.com/library/api',
  noIngestUrl: true,
  libraries: OREGON_FORM_LIBRARIES.map((l) => l.sourceLibraryId),
}

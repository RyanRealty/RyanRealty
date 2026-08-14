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
    const oref = String(name || '').match(/\\bOREF[- ]?(\\d{3}[A-Z]?)\\b/i);
    if (oref) return oref[1].toUpperCase();
    const lead = String(name || '').match(/^(\\d{3}[A-Z]?)\\b/);
    return lead ? lead[1].toUpperCase() : null;
  }
  function parseVer(name) {
    const dated = String(name || '').match(/\\((\\d{1,2}\\/\\d{4})\\)/);
    if (dated) return dated[1];
    const rev = String(name || '').match(/\\bRev\\.?\\s*([\\d.]+)/i);
    return rev ? rev[1] : null;
  }
  const out = { checkedAt: new Date().toISOString(), libraries: [] };
  for (const lib of libs) {
    const all = [];
    let skip = 0;
    const take = 500;
    for (;;) {
      const url = base + '/form-versions?libraryId=' + lib.sourceLibraryId + '&api-version=2.0&skip=' + skip + '&take=' + take;
      const res = await fetch(url, { credentials: 'include', headers: H });
      if (!res.ok) { alert('SkySlope list failed for ' + lib.libraryCode + ' (' + res.status + ').'); return; }
      const json = await res.json();
      const batch = (json.result && json.result.formVersionViewModels) || [];
      all.push.apply(all, batch);
      const total = json.result && json.result.totalRecords;
      if (batch.length < take || (typeof total === 'number' && all.length >= total)) break;
      skip += take;
    }
    const current = all.filter(function (v) { return v.status === 'Published' && v.id === v.publishedVersionId; });
    out.libraries.push({
      libraryCode: lib.libraryCode,
      sourceLibraryId: String(lib.sourceLibraryId),
      forms: current.map(function (v) {
        return {
          sourceFormId: String(v.formId),
          sourceVersionId: String(v.id),
          name: v.name,
          formNumber: parseNum(v.name),
          pageCount: v.pageCount == null ? null : v.pageCount,
          versionLabel: parseVer(v.name)
        };
      })
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
  alert('Catalog ready: ' + out.libraries.map(function (l) { return l.libraryCode + ' ' + l.forms.length; }).join(', ') + '. Paste it on /admin/forms.');
})();`
}

export const FORM_CATALOG_SCRIPT_RULES = {
  origin: 'https://forms.skyslope.com/library/api',
  noIngestUrl: true,
  libraries: OREGON_FORM_LIBRARIES.map((l) => l.sourceLibraryId),
}

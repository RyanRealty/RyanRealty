#!/usr/bin/env node
/**
 * DRY-RUN resolver: map every CRM contact's ad-hoc location strings onto the
 * platform's CANONICAL geo entities. READ-ONLY — writes nothing to the DB, only an
 * out/ artifact + a coverage report.
 *
 * Canonical target structure (all existing):
 *   - neighborhood_subdivisions : subdivision_label (MLS name) -> neighborhood_slug  (the rollup)
 *   - boundaries geo_type='neighborhood' : the 28 canonical parents (14 Bend districts + 14 resorts)
 *   - data/resort-communities.json : is_resort + aliases for the 14 resort communities
 *
 * Per contact we resolve:
 *   customSubdivision -> canonical subdivision_label -> parent neighborhood_slug (+ is_resort)
 *   customNeighborhood -> canonical neighborhood_slug (slug OR label form)
 * then reconcile the two and bucket the outcome.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const slugify = (x) => (x == null ? '' : String(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));

// ── canonical reference: the rollup + the parents + is_resort ────────────────
async function pullAll(table, cols) {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

const ns = await pullAll('neighborhood_subdivisions', 'neighborhood_slug,neighborhood_label,subdivision_label');
// subdivision(slug) -> set of parent neighborhood_slugs (usually 1; >1 = ambiguous)
const subToNbhd = new Map();
for (const r of ns) {
  const k = slugify(r.subdivision_label);
  if (!k) continue;
  if (!subToNbhd.has(k)) subToNbhd.set(k, new Set());
  subToNbhd.get(k).add(r.neighborhood_slug);
}
// canonical neighborhood slugs + a label->slug alias map
const nbhdSlugs = new Set(ns.map((r) => r.neighborhood_slug));
const nbhdLabelToSlug = new Map();
for (const r of ns) {
  nbhdLabelToSlug.set(slugify(r.neighborhood_label), r.neighborhood_slug);
  nbhdLabelToSlug.set(slugify(r.neighborhood_slug), r.neighborhood_slug);
}

// registry: is_resort per neighborhood slug
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'resort-communities.json'), 'utf8'));
const isResort = new Map();
for (const c of registry.communities) isResort.set(c.slug, c.is_resort === true);

function canonNeighborhood(raw) {
  if (!raw) return null;
  const s = slugify(raw);
  if (nbhdSlugs.has(s)) return s;               // already a canonical slug
  if (nbhdLabelToSlug.has(s)) return nbhdLabelToSlug.get(s); // label form -> slug
  return null;
}

// ── contacts ─────────────────────────────────────────────────────────────────
const people = await pullAll('crm_people', 'id,deleted,custom');
const B = {
  total: 0, has_sub: 0, has_nbhd: 0, has_any: 0,
  sub_resolved: 0, sub_ambiguous: 0, sub_unmatched: 0,
  nbhd_resolved: 0, nbhd_unmatched: 0,
  final_neighborhood: 0, both_paths_agree: 0, both_paths_conflict: 0,
  no_location: 0,
};
const unmatchedSub = new Map();
const unmatchedNbhd = new Map();
const resolvedDist = new Map();
const mapping = [];

for (const p of people) {
  if (p.deleted) continue;
  B.total++;
  const c = p.custom || {};
  const rawSub = (c.customSubdivision || '').toString().trim() || null;
  const rawNbhd = (c.customNeighborhood || '').toString().trim() || null;
  if (!rawSub && !rawNbhd) { B.no_location++; continue; }
  B.has_any++;
  if (rawSub) B.has_sub++;
  if (rawNbhd) B.has_nbhd++;

  // subdivision -> parent neighborhood.
  // Match order: exact rollup -> phase-suffix-stripped rollup -> the slug IS a
  // canonical neighborhood (single-name resort like pronghorn/caldera-springs).
  let subNbhd = null, subCanonKey = null, subVia = null;
  if (rawSub) {
    subCanonKey = slugify(rawSub);
    const phaseBase = subCanonKey.replace(/-(phase|phases|ph)-.*$/, '');
    let parents = subToNbhd.get(subCanonKey) || (phaseBase !== subCanonKey ? subToNbhd.get(phaseBase) : null);
    if (!parents && nbhdSlugs.has(subCanonKey)) parents = new Set([subCanonKey]);         // sub name == resort slug
    if (!parents && phaseBase !== subCanonKey && nbhdSlugs.has(phaseBase)) parents = new Set([phaseBase]);
    if (!parents) { B.sub_unmatched++; unmatchedSub.set(rawSub, (unmatchedSub.get(rawSub) || 0) + 1); }
    else if (parents.size === 1) { B.sub_resolved++; subNbhd = [...parents][0]; subVia = 'string+phase'; }
    else { B.sub_ambiguous++; subNbhd = [...parents][0]; subVia = 'ambiguous'; }
  }
  // neighborhood field -> canonical
  let fieldNbhd = null;
  if (rawNbhd) {
    fieldNbhd = canonNeighborhood(rawNbhd);
    if (fieldNbhd) B.nbhd_resolved++;
    else { B.nbhd_unmatched++; unmatchedNbhd.set(rawNbhd, (unmatchedNbhd.get(rawNbhd) || 0) + 1); }
  }
  // reconcile: subdivision rollup is authoritative; field is fallback / cross-check
  const finalNbhd = subNbhd || fieldNbhd;
  if (subNbhd && fieldNbhd) { if (subNbhd === fieldNbhd) B.both_paths_agree++; else B.both_paths_conflict++; }
  if (finalNbhd) {
    B.final_neighborhood++;
    resolvedDist.set(finalNbhd, (resolvedDist.get(finalNbhd) || 0) + 1);
    mapping.push({ id: p.id, neighborhood_slug: finalNbhd, is_resort: isResort.get(finalNbhd) ?? null, subdivision_key: subNbhd ? subCanonKey : null, via: subNbhd ? 'subdivision-rollup' : 'neighborhood-field' });
  }
}

const top = (m, n = 25) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
const report = {
  buckets: B,
  final_neighborhood_pct_of_has_any: +(100 * B.final_neighborhood / B.has_any).toFixed(1),
  resolved_neighborhood_distribution: top(resolvedDist, 30),
  top_unmatched_subdivisions_for_manual_map: top(unmatchedSub, 25),
  top_unmatched_neighborhoods: top(unmatchedNbhd, 25),
};
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', 'crm-geo-mapping-dryrun.json'), JSON.stringify({ generatedFor: 'dry-run', mapping }, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`\nwrote ${mapping.length} proposed mappings -> out/crm-geo-mapping-dryrun.json (NO db writes)`);

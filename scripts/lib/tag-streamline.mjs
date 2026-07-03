/**
 * tag-streamline v2 (pure) — corrected per the two adversarial audits
 * (CRM_STREAMLINE_AUDIT_FINDINGS_2026-07-03.md + CRM_STREAMLINE_V2_AUDIT_FINDINGS_2026-07-03.md)
 * and Matt's decisions (2026-07-03): Sellers = stage-only; neighborhood/subdivision/city
 * are single-value FIELDS (already authoritative) — the tags are pollution and are dropped,
 * never migrated field-from-tag.
 *
 * NO Supabase, NO fs. Imported by scripts/_tag-streamline-migrate.mjs and unit-tested.
 */

// ── SACRED: never renamed, merged, moved, or dropped. Matched case-insensitively like
//    lib/crm/suppressions.ts (TAG_CHANNEL). Kept verbatim (original casing preserved).
//    All 7 live send-gate tags are here; do_not_text added per audit V2-P2-2.
export const SACRED = new Set(
  [
    'compliance:hard-stop',
    'contact:do-not-text',
    'contact:do-not-call',
    'contact:do-not-email',
    'do_not_email',
    'do_not_text',
    'unsubscribed',
    'bounced',
    'complained',
    'compliance:dnc-registry',
    'compliance:deceased',
    'tcpa:litigator',
  ].map((t) => t.toLowerCase()),
);
export const isSacred = (tag) => SACRED.has(String(tag).toLowerCase());

// ── Central Oregon city allow-list (mailing = local when OR + one of these).
export const CENTRAL_OR_CITIES = new Set([
  'bend', 'redmond', 'sisters', 'la pine', 'sunriver', 'terrebonne', 'tumalo',
  'prineville', 'madras', 'culver', 'powell butte', 'crooked river ranch',
  'black butte ranch', 'camp sherman', 'alfalfa', 'brothers',
]);

// address types that are NOT real mailing addresses (phones mis-stored in addresses[]).
const NON_MAILING_TYPES = new Set(['mobile', 'landline', 'phone', 'fax']);

const LOCATION_OCCUPANCY_LEGACY = new Set([
  'owner:occupied', 'owner-occupied', 'owner:absentee', 'absentee', 'absentee owner',
  'owner:absentee-local', 'owner:absentee-outofstate',
  'geo:local', 'geo:out-of-state', 'geo:out-of-area',
  'state:in-state', 'state:out-of-state', 'in-state', 'out-of-state', 'out of state',
  'in-state-out-of-area',
].map((t) => t.toLowerCase()));

// Tags whose data now lives in an authoritative custom FIELD — drop the tag.
// (neighborhood/subdivision/city field-writes are handled by the runner for the
//  single-tag+empty-field safe case; multi-tag+empty is flagged for geocode.)
const FIELD_OR_RECOMPUTE_PREFIXES = [
  'neighborhood:', 'subdivision:', 'city:', 'area:', 'tenure:', 'equity:',
  'seller-score:', 'dom-tier:', 'brokerage:', 'realtor-source:', 'industry:',
  'lifecycle:', 'leadscore:', 'lead-tier:',
];
const RETIRE_PREFIXES = [
  'import:', 'enrich:', 'owner-lookup:', 'expired-detected:', 'expired-mls:',
  'expired-status:', 'fb-audience:', 'auto:', 'repeat-relist:',
  'broker:', 'status:', 'src:', 'medium:', 'channel:', 'campaign:',
  'contact:has', 'contact:mobile', 'contact:landline',
];
const RETIRE_EXACT = new Set(
  ['bend', 'import', 'redmond', 'sisters', 'sunriver', 'la pine', 'terrebonne',
   'tumalo', 'prineville', 'realtor', 'migration broker', 'seller guide',
   'buyer intent', 'canceled', 'withdrawn', 'do_not_text' /* handled as sacred first */]
    .map((t) => t.toLowerCase()),
);
// KEEP the deliverability suppressor tags Matt chose to keep; retire the pure noise.
const EMAIL_KEEP = new Set(['email:invalid', 'email:bounced']);
const EMAIL_RETIRE = new Set(['email:valid', 'email:unverified', 'email:catchall']);
// source:* is attribution and kept — EXCEPT these cruft sources.
const SOURCE_RETIRE = new Set(['source:county-assessor', 'source:manual', 'source: chatgpt.com']);
const SOURCE_RETIRE_PREFIX = ['source:farm-merge'];

const KEEP_PREFIXES = ['audience:', 'seller:', 'buyer:', 'source:', 'exclude:', 'segment:', 'vendor:', 'tcpa:'];

// ── Signal detectors (drive segment emission; additive, keep attribution) ──────────
export function isExpiredSignal(low) {
  if (['expired', 'expired listings', 'intent:expired-listing', 'status:expired',
       'expired-status:expired', 'seller:expired-untouched',
       'source:expired-listing-cron', 'source:expired-listing-mls'].includes(low)) return true;
  if (/^expiredwave\d+$/.test(low)) return true;
  return false; // expired-mls:*, expired-detected:*, import:expired-backfill* are NOT a segment signal
}
export const isFsboSignal = (low) => low === 'fsbo' || low === 'intent:fsbo' || low.startsWith('source:fsbo');
export const isBuyerSignal = (low) => low === 'buyer' || low === 'buyer intent' || low === 'audience:buyer' || low.startsWith('buyer:');
export const isCityRealtorTag = (low) => low !== 'realtor' && String(low).endsWith(' realtor');
export const isRealtorIdentity = (low) =>
  low === 'industry:realtor' || low === 'realtor' || low === 'audience:broker-recruit' ||
  isCityRealtorTag(low) || low === 'migration broker';
export const isMigrationRealtorTag = (low) => isCityRealtorTag(low) || low === 'migration broker';

/** Per-tag keep/drop for the SURVIVING tag array (segments are emitted separately). */
export function classify(tag) {
  const low = String(tag).toLowerCase();
  if (isSacred(tag)) return { action: 'keep', target: tag, reason: 'SACRED compliance/suppression' };
  if (LOCATION_OCCUPANCY_LEGACY.has(low)) return { action: 'drop', target: null, reason: 're-derived from addresses' };
  if (low === 'audience:broker-recruit') return { action: 'drop', target: null, reason: 'realtor identity → realtor:local' };
  if (low === 'segment:my-leads' || low === 'segment:farm-merge') return { action: 'drop', target: null, reason: 'operational, not a canonical segment' };
  if (EMAIL_KEEP.has(low)) return { action: 'keep', target: tag, reason: 'deliverability suppressor (kept)' };
  if (EMAIL_RETIRE.has(low) || low.startsWith('email:')) return { action: 'drop', target: null, reason: 'email status cruft' };
  if (SOURCE_RETIRE.has(low) || SOURCE_RETIRE_PREFIX.some((p) => low.startsWith(p))) return { action: 'drop', target: null, reason: 'source cruft' };
  for (const p of FIELD_OR_RECOMPUTE_PREFIXES) if (low.startsWith(p)) return { action: 'drop', target: null, reason: `field/recompute (${p}*)` };
  if (RETIRE_EXACT.has(low)) return { action: 'drop', target: null, reason: 'legacy bare dupe / identity-captured' };
  for (const p of RETIRE_PREFIXES) if (low.startsWith(p)) return { action: 'drop', target: null, reason: `operational cruft (${p}*)` };
  if (isCityRealtorTag(low)) return { action: 'drop', target: null, reason: 'city-realtor → realtor:migration' };
  for (const p of KEEP_PREFIXES) if (low.startsWith(p)) return { action: 'keep', target: tag, reason: 'canonical prefix' };
  if (!String(tag).includes(':')) return { action: 'drop', target: null, reason: 'unclassified no-prefix' };
  return { action: 'keep', target: tag, reason: 'unmatched prefixed — kept (review)' };
}

export const isLocalOR = (state, city) =>
  String(state || '').trim().toUpperCase() === 'OR' &&
  CENTRAL_OR_CITIES.has(String(city || '').trim().toLowerCase());

/**
 * Address-derived occupancy + location. Hardened mailing selection (audit V2-P2-8):
 * the "mailing" address must be a real address (has street+state) and NOT a phone
 * entry mis-stored in addresses[].
 */
export function deriveFromAddresses(addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) return { tags: [], occ: 'unknown', location: null };
  const isRealMailing = (a) => a && a.type !== 'Property' && !NON_MAILING_TYPES.has(String(a.type || '').toLowerCase())
    && (String(a.street || '').trim() !== '');
  const prop = addresses.find((a) => a && a.type === 'Property') || null;
  const mail = addresses.find(isRealMailing) || addresses.find((a) => a && a.type !== 'Property' && !NON_MAILING_TYPES.has(String(a.type || '').toLowerCase())) || null;

  if (prop && mail) {
    const mState = String(mail.state || '').trim().toUpperCase();
    const mCity = String(mail.city || '').trim().toLowerCase();
    let location = null;
    if (mState && mState !== 'OR') location = 'location:out-of-state';
    else if (mState === 'OR') location = CENTRAL_OR_CITIES.has(mCity) ? 'location:local' : 'location:out-of-area';
    const tags = ['owner:absentee'];
    if (location) tags.push(location);
    return { tags, occ: 'absentee', location };
  }
  if (!prop && mail && isLocalOR(mail.state, mail.city)) {
    return { tags: ['owner:occupied', 'location:local'], occ: 'occupied', location: 'location:local' };
  }
  if (prop && !mail) return { tags: [], occ: 'unknown-no-mailing', location: null };
  return { tags: [], occ: 'unknown', location: null };
}

/**
 * Rewrite one person's tags per the corrected plan. Pure.
 * @returns { tags: string[], occ, location, segments: string[] }
 * Segments: additive from signals + stage + address. Compliance kept verbatim.
 */
export function rewritePersonTags(tags, addresses, custom, stage) {
  const arr = Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t) : [];
  const out = new Set();
  const sacredOriginals = [];
  let expired = false, fsbo = false, buyer = false, realtor = false, migration = false;

  for (const t of arr) {
    const low = t.toLowerCase();
    if (isSacred(t)) { sacredOriginals.push(t); }
    else { const c = classify(t); if (c.action === 'keep') out.add(c.target); }
    if (isExpiredSignal(low)) expired = true;
    if (isFsboSignal(low)) fsbo = true;
    if (isBuyerSignal(low)) buyer = true;
    if (isRealtorIdentity(low)) realtor = true;
    if (isMigrationRealtorTag(low)) migration = true;
  }

  // custom.classification is another expired/fsbo signal.
  const cls = String(custom?.customClassification ?? '').trim().toUpperCase();
  if (cls === 'EXPIRED') expired = true;
  if (cls === 'FSBO') fsbo = true;

  // ── Segment emission (additive) ──────────────────────────────────────────────
  if (expired) out.add('segment:expired');
  if (fsbo) out.add('segment:fsbo');
  if (buyer) out.add('segment:buyer');
  if (String(stage || '') === 'Real Estate Agent') realtor = true;      // stage is realtor identity
  if (String(stage || '') === 'Seller Prospect') out.add('segment:seller'); // Sellers = stage-only (Matt 2026-07-03)
  if (realtor) {
    out.add('industry:realtor');
    out.add(migration ? 'realtor:migration' : 'realtor:local');
  }

  // ── Address-derived occupancy/location + out-of-area segment ──────────────────
  const d = deriveFromAddresses(addresses);
  for (const dt of d.tags) out.add(dt);
  if (d.occ === 'absentee' && (d.location === 'location:out-of-area' || d.location === 'location:out-of-state')) {
    out.add('segment:out-of-area');
  }

  const canonical = [...out].sort();
  return {
    tags: [...new Set([...sacredOriginals, ...canonical])],
    occ: d.occ,
    location: d.location,
    segments: canonical.filter((t) => t.startsWith('segment:') || t.startsWith('realtor:')),
  };
}

/**
 * Field-write plan for one person (audit P0-1 + V2-1): capture the single-value
 * enrichment into custom ONLY where the target field is empty AND the tag is
 * unambiguous (exactly one value). Multi-valued + empty → flagged, never guessed.
 * Never overwrites a populated field.
 */
export function fieldWritePlan(tags, custom) {
  const arr = Array.isArray(tags) ? tags : [];
  const plan = {}; const needsGeocode = [];
  // city is coarse + already lives in addresses[].city → retire the tag, don't field-capture.
  const spec = [
    { prefix: 'neighborhood:', field: 'customNeighborhood', alt: 'neighborhood' },
    { prefix: 'subdivision:', field: 'customSubdivision', alt: 'subdivision' },
  ];
  for (const { prefix, field, alt } of spec) {
    const vals = arr.filter((t) => typeof t === 'string' && t.toLowerCase().startsWith(prefix));
    if (vals.length === 0) continue;
    const filled = (custom && (String(custom[field] ?? '').trim() || String(custom[alt] ?? '').trim())) || '';
    if (filled) continue;                          // never overwrite
    if (vals.length === 1) plan[field] = vals[0].slice(prefix.length); // safe: unambiguous
    else needsGeocode.push({ field, prefix, count: vals.length });     // ambiguous → geocode later
  }
  return { plan, needsGeocode };
}

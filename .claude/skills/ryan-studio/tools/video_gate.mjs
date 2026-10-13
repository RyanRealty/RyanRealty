#!/usr/bin/env node
// Ryan Studio video gate. Every video must have a brief and pass this gate before any render.
// Usage: node tools/video_gate.mjs <brief.json> <timeline.json>
// Exit 0 = pass (warnings may print). Exit 1 = fail, with plain reasons. Exit 2 = usage/parse error.
// Rules: rules/VIDEO_TYPES.md + tools/video_types.json (RULEBOOK.md wins).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROLES = ['hook', 'intro', 'body', 'payoff', 'endcard'];
const REAL = new Set(['mls_photo', 'listing_photo', 'phone_footage', 'public_meeting', 'stock_licensed', 'other']);
const PHOTO = new Set(['mls_photo', 'listing_photo']);
const SAFE = { maxX: 960, maxY: 1640 };
const ADDRESS = /\b\d{2,6}\s+(?:[NSEW]\.?\s+)?[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Blvd|Boulevard|Pl|Place|Loop|Cir|Circle|Pkwy|Hwy|Trl|Trail|Ter)\b\.?/;
const NAMEISH = /\b(?:Mr|Mrs|Ms|Dr)\.?\s+[A-Z][a-z]+|\bthe\s+[A-Z][a-z]+s\b(?=\s+(?:family|sold|bought|closed|purchased))/;

export function gate(brief, timeline, cfg) {
  const fails = [], warns = [];
  const fail = (m) => fails.push(m), warn = (m) => warns.push(m);
  const req = ['video_type', 'title', 'hook', 'length_s', 'numbers', 'footage', 'end_card', 'caption'];
  for (const k of req) if (brief[k] === undefined) fail(`Brief is missing "${k}".`);
  const typeCfg = cfg.types[brief.video_type];
  if (!typeCfg) { fail(`Unknown video_type "${brief.video_type}". Use one of: ${Object.keys(cfg.types).join(', ')}.`); return { fails, warns }; }
  const t = { ...cfg.defaults, ...typeCfg };
  const overrides = new Set((brief.matt_overrides || []).map((o) => o.rule));
  const beats = Array.isArray(timeline.beats) ? timeline.beats : [];
  if (!beats.length) fail('Timeline has no beats.');

  // Hook
  if (brief.hook) {
    if (typeof brief.hook.time_s !== 'number') fail('Brief hook needs time_s (seconds when the hook is fully on screen).');
    else if (brief.hook.time_s > t.hook_max_s) fail(`Hook lands at ${brief.hook.time_s}s; ${brief.video_type} needs it by ${t.hook_max_s}s.`);
    if (!brief.hook.text || !brief.hook.text.trim()) fail('Brief hook text is empty.');
  }
  if (beats.length) {
    if (beats[0].role !== 'hook') fail(`First beat is "${beats[0].role}", it must be the hook.`);
    else if (beats[0].start > t.hook_max_s) fail(`Hook beat starts at ${beats[0].start}s, after ${t.hook_max_s}s.`);
  }

  // Sequence
  const seen = beats.map((b) => b.role);
  for (const b of beats) if (!ROLES.includes(b.role)) fail(`Beat "${b.id}" has role "${b.role}"; roles are ${ROLES.join(', ')}.`);
  let last = -1;
  for (const b of beats) { const i = ROLES.indexOf(b.role); if (i >= 0 && i < last) fail(`Beat "${b.id}" (${b.role}) is out of order. Sequence is hook, intro, body, payoff, end card.`); if (i > last) last = i; }
  if (!seen.includes('payoff')) fail('No payoff beat before the end card.');
  if (t.requires_end_card) {
    if (seen[seen.length - 1] !== 'endcard') fail('Last beat must be the locked end card.');
    const ec = brief.end_card || {};
    if (ec.spec !== 'templates/END_CARD_SPEC.md') fail('Brief end_card.spec must be templates/END_CARD_SPEC.md (locked card, RULEBOOK §1).');
    if (ec.phone !== '541.703.3095') fail('End card phone must be 541.703.3095.');
  }

  // Length
  const dur = typeof timeline.duration_s === 'number' ? timeline.duration_s : (beats.length ? Math.max(...beats.map((b) => b.end)) : brief.length_s);
  if (typeof brief.length_s === 'number' && Math.abs(brief.length_s - dur) > 0.5) fail(`Brief says ${brief.length_s}s but the timeline runs ${dur}s.`);
  if (dur < t.min_s) fail(`Runs ${dur}s; ${brief.video_type} needs at least ${t.min_s}s.`);
  if (dur > t.hard_max_s && !overrides.has('length')) fail(`Runs ${dur}s; hard max for ${brief.video_type} is ${t.hard_max_s}s.`);
  else if (dur > t.max_s && !(brief.length_reason || '').trim() && !overrides.has('length')) fail(`Runs ${dur}s, over ${t.max_s}s, with no length_reason in the brief.`);

  // Holds and safe area
  for (const b of beats) {
    const hold = +(b.end - b.start).toFixed(3);
    if (!(hold >= t.min_hold_s)) fail(`Beat "${b.id}" holds ${hold}s; every beat holds at least ${t.min_hold_s}s (RULEBOOK §2b).`);
    for (const box of b.boxes || []) {
      if (box.x + box.w > SAFE.maxX || box.y + box.h > SAFE.maxY) fail(`Beat "${b.id}" text "${box.label || ''}" leaves the safe area (x <= ${SAFE.maxX}, y <= ${SAFE.maxY}).`);
    }
  }

  // Numbers
  const hero = beats.filter((b) => b.number !== undefined && b.number !== null && b.role !== 'endcard');
  const heroVals = new Set(hero.map((b) => String(b.number)));
  const max = t.max_hero_numbers;
  if (heroVals.size > max && !overrides.has('hero_numbers')) fail(`${heroVals.size} different numbers on screen (${[...heroVals].join(', ')}); ${brief.video_type} allows ${max}.`);
  const known = new Set((brief.numbers || []).flatMap((n) => [String(n.on_screen), String(n.value)]));
  for (const v of heroVals) if (!known.has(v)) fail(`Number "${v}" is on screen but has no row in brief.numbers (definition, window, geography, source).`);
  for (const n of brief.numbers || []) {
    for (const k of ['definition', 'window', 'geography', 'source']) if (!n[k] || !String(n[k]).trim()) fail(`Number "${n.on_screen}" is missing ${k}.`);
    if (/^\s*(last|past)\s+\d+\s+days\s*$/i.test(n.window || '')) warn(`Number "${n.on_screen}" window "${n.window}": write exact dates unless the window truly matches.`);
  }

  // Footage and rights
  const footage = brief.footage || [];
  if (t.requires_real_footage && !footage.some((f) => REAL.has(f.kind))) fail('No real footage or photos listed (RULEBOOK §2a.3). Maps and plates sit on real footage, not instead of it.');
  for (const f of footage) {
    if (f.rights === 'unclear' || !f.rights) fail(`Footage ${f.path}: rights are unclear. Do not use it.`);
    if (PHOTO.has(f.kind)) {
      if (!['ryan_listing_side', 'license_covers_social'].includes(f.rights)) fail(`Listing photo ${f.path}: only allowed when Ryan Realty was the listing side or the license covers social reuse.`);
      if (f.restyled) fail(`Listing photo ${f.path} is restyled. MLS photos get camera motion only.`);
      if (f.house_number_checked !== true) fail(`Listing photo ${f.path}: check it at full size for house numbers and set house_number_checked.`);
    }
  }

  // Copy checks across everything a viewer can read
  const texts = [brief.title, brief.hook?.text, brief.caption, ...beats.map((b) => b.text), ...beats.flatMap((b) => (b.boxes || []).map((x) => x.label)), ...footage.map((f) => f.path)].filter(Boolean).map(String);
  const all = texts.join('\n');
  if (/[\u2013\u2014]/.test(all)) fail('Em or en dash found. Use a period, a comma, or "to" (RULEBOOK §3).');
  const low = all.toLowerCase();
  for (const w of cfg.banned_phrases) if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(low)) fail(`Banned phrase "${w}" (RULEBOOK §3).`);
  if (/it'?s not just .{1,40}, it'?s/i.test(all)) fail('Banned pattern "it\'s not just X, it\'s Y".');
  if (/!{2,}/.test(all)) fail('Exclamation stack found.');
  for (const s of texts) { const m = s.match(ADDRESS); if (m) fail(`Looks like an address: "${m[0]}". No addresses anywhere.`); }
  for (const s of texts) { const m = s.match(NAMEISH); if (m) fail(`Looks like a person's name: "${m[0]}". No buyer or seller names.`); }
  for (const w of cfg.fair_housing_flags) if (new RegExp(`\\b${w}\\b`, 'i').test(low)) fail(`Fair housing flag "${w}": describe homes and places, never people.`);

  // Type specifics
  if (t.requires_sources && !(brief.sources || []).length) fail('Civic piece needs sources (meeting, date, clip id, documents).');
  if (t.requires_special_ad_category && brief.special_ad_category !== t.requires_special_ad_category) fail('Buyer ad must declare special_ad_category "housing" (no age, gender or ZIP targeting).');
  if (t.requires_persona && !brief.persona) fail('Buyer ad needs a persona (relocator, first_time, move_up, second_home). The hook picks the buyer.');
  if (/buyer'?s market/i.test(all)) warn('"Buyer\'s market" wording: only when months of supply is 6 or more for that geography. Bend is about 3; say "buyers have leverage".');
  if (brief.video_type === 'closing' && dur <= 3) fail('Closings are never a 3 second price + closed clip.');
  if (brief.music && brief.music.song && !brief.music.picker_start) warn('Music set but no IG picker start time (m:ss).');
  if (t.requires_loop && !timeline.loop_seam) warn('Timeline has no loop_seam note (last frame should flow back into frame 0).');
  return { fails, warns };
}

function main() {
  const [bp, tp] = process.argv.slice(2);
  if (!bp || !tp) { console.error('Usage: node tools/video_gate.mjs <brief.json> <timeline.json>'); process.exit(2); }
  let brief, timeline, cfg;
  try {
    brief = JSON.parse(readFileSync(bp, 'utf8'));
    timeline = JSON.parse(readFileSync(tp, 'utf8'));
    cfg = JSON.parse(readFileSync(join(here, 'video_types.json'), 'utf8'));
  } catch (e) { console.error(`Could not read input: ${e.message}`); process.exit(2); }
  const { fails, warns } = gate(brief, timeline, cfg);
  for (const w of warns) console.log(`WARN  ${w}`);
  if (fails.length) { for (const f of fails) console.log(`FAIL  ${f}`); console.log(`\nVIDEO GATE FAILED (${fails.length}). Do not render. Fix the brief or timeline and run again.`); process.exit(1); }
  console.log(`VIDEO GATE PASSED: ${brief.video_type} "${brief.title}".`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

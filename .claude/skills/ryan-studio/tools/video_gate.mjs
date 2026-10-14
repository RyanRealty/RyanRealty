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
export const ADDRESS = /\b\d{2,6}\s+(?:[NSEW]\.?\s+)?[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Blvd|Boulevard|Pl|Place|Loop|Cir|Circle|Pkwy|Hwy|Trl|Trail|Ter)\b\.?/;
export const NAMEISH = /\b(?:Mr|Mrs|Ms|Dr)\.?\s+[A-Z][a-z]+|\bthe\s+[A-Z][a-z]+s\b(?=\s+(?:family|sold|bought|closed|purchased))/;


// Spoken-voice check (Matt, 2026-10-13): VO must read like a person talking on camera, not prose or an ad.
export const SPOKEN = {
  maxAvgWords: 14, maxSentenceWords: 22, maxUncontractedShare: 0.34,
  uncontracted: ['it is', 'you are', 'we are', 'they are', 'we will', 'you will', 'i will', 'it will', 'do not', 'does not', 'did not', 'is not', 'are not', 'can not', 'cannot', 'will not', 'would not', 'should not', 'could not', 'that is', 'there is', 'here is', 'what is', 'i am', 'let us', 'i have', 'you have', 'we have', 'have not', 'has not'],
  cliches: ['look no further', 'dream home', "don't miss out", 'do not miss out', 'unparalleled', 'nestled', 'boasts', 'act now', 'limited time', 'opportunity awaits', "whether you're", 'whether you are', 'introducing'],
  written: ['furthermore', 'additionally', 'moreover', 'in conclusion', 'utilize', 'utilise'],
  markers: /\b(you|your|you're|you've|you'll|so|okay|ok|honestly|here's the thing|hey|look)\b/i,
};
export function spokenVoiceCheck(script) {
  const fails = [];
  const text = String(script || '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return ['VO script is empty.'];
  const low = text.toLowerCase().replace(/[\u2019]/g, "'");
  const count = (w) => (low.match(new RegExp(`\\b${w.replace(/ /g, '\\s+')}\\b`, 'g')) || []).length;
  const unc = SPOKEN.uncontracted.reduce((n, w) => n + count(w), 0);
  const con = (low.match(/\b[a-z]+'(s|re|ll|ve|d|m|t)\b/g) || []).length;
  if (unc >= 2 && unc / (unc + con) > SPOKEN.maxUncontractedShare) fail(`Too few contractions: ${unc} uncontracted pairs (it is, you are, do not...) vs ${con} contractions. Talk like a person: it's, you're, don't.`);
  const sentences = text.split(/(?:\.{3}|…|[.?!])+/).map((x) => x.trim()).filter((x) => /[a-z]/i.test(x));
  const lens = sentences.map((x) => x.split(/\s+/).length);
  const avg = lens.reduce((a, b) => a + b, 0) / (lens.length || 1);
  if (avg > SPOKEN.maxAvgWords) fail(`Sentences average ${avg.toFixed(1)} words; spoken VO averages ${SPOKEN.maxAvgWords} or fewer.`);
  sentences.forEach((x, i) => { if (lens[i] > SPOKEN.maxSentenceWords) fail(`Sentence ${i + 1} runs ${lens[i]} words (max ${SPOKEN.maxSentenceWords}): "${x.slice(0, 60)}..."`); });
  for (const c of SPOKEN.cliches) if (low.includes(c)) fail(`Ad cliche "${c}".`);
  for (const w of SPOKEN.written) if (new RegExp(`\\b${w}\\b`).test(low)) fail(`Written-only word "${w}".`);
  if (/;/.test(text)) fail('Semicolon in VO. Nobody speaks a semicolon; split it.');
  if (/[()]/.test(text)) fail('Parentheses in VO. Say it or cut it.');
  if (!SPOKEN.markers.test(low)) fail('No "you" and no conversational marker (so, okay, honestly, here\'s the thing). Talk to the viewer.');
  return fails;
  function fail(m) { fails.push(`Spoken voice: ${m}`); }
}

export const SIGNATURE_FLOOR = 'this film has no approved signature technique; every film runs at least one approved signature technique (pick one from the registry, or build one and have Matt approve its reel)';
export const CREATIVE_FIELDS = ['feel', 'constraint', 'lineage', 'one_sentence'];
const CREATIVE_HELP = {
  feel: 'one target emotion, chosen first',
  constraint: 'one formal constraint chosen before the story',
  lineage: 'the non-AI artistic lineage it borrows from',
  one_sentence: 'the idea in one sentence',
};

/** `registry` (the techniques object) is for tests; the CLI reads techniques/registry.json. */
export function gate(brief, timeline, cfg, registry) {
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


  // Spec rules (mandatory creation-time block, Matt 2026-10-13)
  const sr = brief.spec_rules;
  if (!sr) fail('Brief is missing "spec_rules" (the mandatory creation-time rules). Fill it before making anything.');
  else {
    const EC = ['logo', 'Quality / Local / Service', 'Call now 541.703.3095'];
    if (!(typeof sr.hook_by_s === 'number' && sr.hook_by_s <= 2)) fail('spec_rules.hook_by_s must be 2s or less.');
    if (JSON.stringify(sr.length_s_range) !== '[15,30]') fail('spec_rules.length_s_range must be [15,30].');
    if (typeof brief.length_s === 'number' && (brief.length_s < 15 || brief.length_s > 30) && !overrides.has('length')) fail(`Length ${brief.length_s}s is outside 15 to 30s.`);
    for (const k of ['real_footage', 'sound_off_readable', 'loopable', 'no_top_team_wording', 'no_price_closed_flash', 'same_process_any_tool']) if (sr[k] !== true) fail(`spec_rules.${k} must be true.`);
    if (!(sr.real_numbers_count >= 1 && sr.real_numbers_count <= 2)) fail('spec_rules.real_numbers_count must be 1 or 2.');
    if (sr.captions?.style !== 'tiktok_burned_in' || sr.captions?.synced_to_vo !== true) fail('Captions must be TikTok-style burned in and synced to the voiceover.');
    const vo = sr.voiceover || {};
    if (vo.voice !== 'female' || vo.tone !== 'warm_conversational') fail('Voiceover must be a female, warm, conversational voice.');
    if (!['elevenlabs_v3', 'grok_tts'].includes(vo.engine)) fail('spec_rules.voiceover.engine must be elevenlabs_v3 or grok_tts.');
    if (vo.script_follows_engine_rules !== true) fail('VO script must follow the engine\'s own best practices.');
    if (!vo.script || !String(vo.script).trim()) fail('spec_rules.voiceover.script is required (the spoken-voice check reads it).');
    else for (const m of spokenVoiceCheck(vo.script)) fail(m);
    if (vo.script) {
      if (vo.engine === 'elevenlabs_v3') { if (/<break/i.test(vo.script)) fail('ElevenLabs v3 script uses break tags. Use ellipses and audio tags.'); if (/\d/.test(vo.script)) fail('ElevenLabs v3 script has digits. Spell numbers out.'); if (/\[(pause|breath)\]/i.test(vo.script)) fail('[pause]/[breath] are Grok TTS tags, not ElevenLabs v3.'); }
      if (vo.engine === 'grok_tts' && /<break/i.test(vo.script)) fail('Grok TTS script uses break tags. Use [pause] / [breath].');
    }
    if (JSON.stringify(sr.end_card_sequence) !== JSON.stringify(EC)) fail('End card must be: logo, then Quality / Local / Service, then Call now 541.703.3095.');
    if (sr.topic_cta?.text && sr.topic_cta.placement !== 'own_card_before_end_card') fail('A topic CTA gets its own card before the end card, never in place of it.');
  }

  // Footage rights list (rights/footage_rights.json)
  let rl = {}; try { rl = JSON.parse(readFileSync(join(here, '..', 'rights', 'footage_rights.json'), 'utf8')).sources || {}; } catch { fail('rights/footage_rights.json missing.'); }
  const use = brief.special_ad_category || brief.use === 'ads' ? 'ads' : 'organic';
  for (const f of (brief.footage || [])) {
    let src = f.source;
    if (!src) for (const [k, v] of Object.entries(rl)) if ((v.match || []).some((m) => String(f.path || '').toLowerCase().includes(m))) src = k;
    if (!src) continue;
    if (!rl[src]) fail(`Footage ${f.path}: source "${src}" is not in rights/footage_rights.json.`);
    else if (!(rl[src].cleared_for || []).includes(use)) fail(`Footage ${f.path}: ${rl[src].name} is not cleared for ${use}.`);
  }
  // Technique library (Matt 2026-10-14): planned -> ready (built) -> approved (Matt saw its reel).
  // Base techniques need ready or approved; a signature technique needs approved; every film runs
  // at least one approved signature technique. The render preflight and video:check check 15 hold the same floor.
  let reg = registry;
  if (!reg) { try { reg = JSON.parse(readFileSync(join(here, '..', 'techniques', 'registry.json'), 'utf8')).techniques || {}; } catch { reg = {}; fail('techniques/registry.json missing.'); } }
  if (!Array.isArray(brief.techniques) || !brief.techniques.length) fail('Brief needs "techniques": names from techniques/registry.json.');
  else {
    for (const n of brief.techniques) {
      const e = reg[n];
      if (!e) fail(`Technique "${n}" is not in techniques/registry.json.`);
      else if (e.status === 'planned') fail(`Technique "${n}" is planned, not built yet (home: ${e.home || 'unnamed'}). Pick a ready technique; the renderer can only run code that exists.`);
      else if (e.tier === 'signature' && e.status !== 'approved') fail(`Signature technique "${n}" is ${e.status}, not approved: Matt approves a signature technique after seeing its showcase reel.`);
    }
    if (!brief.techniques.some((n) => reg[n] && reg[n].tier === 'signature' && reg[n].status === 'approved')) fail(SIGNATURE_FLOOR);
  }
  // Creative brain piece brief (Matt 2026-10-14): chosen before the story, carried into the manifest.
  const cr = brief.creative;
  if (!cr || typeof cr !== 'object') fail('Brief needs a "creative" block: feel, constraint, lineage, one_sentence (.claude/skills/creative-brain).');
  else for (const k of CREATIVE_FIELDS) {
    const v = cr[k];
    if (typeof v !== 'string' || !v.trim()) fail(`creative.${k} is empty (${CREATIVE_HELP[k]}).`);
    else if (v.length > 200) fail(`creative.${k} runs ${v.length} characters; keep it to 200.`);
  }

  // Type specifics
  if (t.requires_sources && !(brief.sources || []).length) fail('Civic piece needs sources (meeting, date, clip id, documents).');
  if (t.requires_special_ad_category && brief.special_ad_category !== t.requires_special_ad_category) fail('Buyer ad must declare special_ad_category "housing" (no age, gender or ZIP targeting).');
  if (t.requires_persona && !brief.persona) fail('Buyer ad needs a persona (relocator, first_time, move_up, second_home). The hook picks the buyer.');
  if (/\btop[- ]team\b/i.test(all)) fail('"Top team" wording is banned.');
  if (/buyer'?s market/i.test(all)) warn('"Buyer\'s market" wording: only when months of supply is 6 or more for that geography. Bend is about 3.5. "Buyers have leverage" needs leverage figures (price cuts, concessions) and never sits beside a months-of-supply reading under 6.');
  if (beats.some((b) => (b.end - b.start) <= 3 && /\$\s?\d/.test(b.text || '') && /closed|sold/i.test((b.text || '') + ' ' + beats.map((x) => x.text || '').join(' ')) && brief.video_type === 'closing') || (brief.video_type === 'closing' && dur <= 3)) fail('Closings are never a 3 second price + closed clip.');
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

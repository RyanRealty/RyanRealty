// Run: node --test tools/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const gate = join(here, '..', 'video_gate.mjs');
const run = (n) => spawnSync(process.execPath, [gate, join(here, 'fixtures', `${n}.brief.json`), join(here, 'fixtures', `${n}.timeline.json`)], { encoding: 'utf8' });

test('the committed registry approves nothing, so even a compliant brief is refused at the signature floor', () => {
  // Matt 2026-10-14: no film is built from a signature technique he has not seen.
  const r = run('pass');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /at least one approved signature technique/);
  assert.match(r.stdout, /Signature technique "line_draw_riding_dot" is ready, not approved/);
});

test('broken buyer ad fails with plain reasons', () => {
  const r = run('fail');
  assert.equal(r.status, 1, r.stdout);
  for (const re of [/Hook lands at 3.5s/, /First beat is "intro"/, /No payoff/, /Last beat must be the locked end card/, /hard max/, /holds 1.5s/, /safe area/, /3 different numbers/, /no row in brief.numbers/, /rights are unclear/, /restyled/, /house numbers/, /Em or en dash/, /Banned phrase "dream home"/, /Banned phrase "discover"/, /address/, /Fair housing flag/, /special_ad_category/, /persona/, /Exclamation/, /spec_rules/, /techniques/]) assert.match(r.stdout, re);
});

test('usage error exits 2', () => {
  const r = spawnSync(process.execPath, [gate], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});

import { readFileSync } from 'node:fs';
import { gate as g, spokenVoiceCheck } from '../video_gate.mjs';
import { TEST_APPROVER } from '../technique-approval.mjs';
const load = (f) => JSON.parse(readFileSync(join(here, 'fixtures', f), 'utf8'));
const cfg = JSON.parse(readFileSync(join(here, '..', 'video_types.json'), 'utf8'));
const pb = () => load('pass.brief.json'), pt = load('pass.timeline.json');
// A test-only registry: the real one with line_draw_riding_dot approved by the TEST approver (never
// "matt") with a test-only reel, accepted only because the test passes opts.approver. Never the committed file.
const realReg = JSON.parse(readFileSync(join(here, '..', '..', 'techniques', 'registry.json'), 'utf8')).techniques;
const TEST_ONLY = { approved_by: TEST_APPROVER, approved_on: '2026-10-14', reel: 'lib/studio/qa/fixtures/test-only-reel.txt' };
const testReg = { ...realReg, line_draw_riding_dot: { ...realReg.line_draw_riding_dot, status: 'approved', ...TEST_ONLY } };
const fails = (b, reg = testReg, opts = { approver: TEST_APPROVER }) => g(b, pt, cfg, reg, opts).fails.join('\n');
test('compliant market update passes (with its signature technique approved, test registry)', () => {
  assert.equal(fails(pb()), '');
});
test('techniques: a signature needs approved, a base needs ready, and every film has one approved signature', () => {
  assert.match(fails(pb(), realReg), /Signature technique "line_draw_riding_dot" is ready, not approved/);
  const noSig = pb(); noSig.techniques = ['tiktok_caption_burn', 'contact_sheet_review'];
  assert.match(fails(noSig), /no approved signature technique; every film runs at least one approved signature technique/);
  assert.doesNotMatch(fails(pb()), /signature/);
});
test('approval: a row marked approved counts only with Matt, an ISO date and a reel that exists (F1)', () => {
  // The test approver is not accepted where the committed rules apply ("matt" only).
  assert.match(fails(pb(), testReg, {}), /"line_draw_riding_dot" is marked approved but the approval does not hold: it approved_by is "test-only stub", not "matt"/);
  assert.match(fails(pb(), testReg, {}), /at least one approved signature technique/);
  // A bot writing "matt" into a test registry does not pass either: there the approver is the test stub.
  const asMatt = { ...realReg, line_draw_riding_dot: { ...realReg.line_draw_riding_dot, status: 'approved', ...TEST_ONLY, approved_by: 'matt' } };
  assert.match(fails(pb(), asMatt), /approved_by is "matt", not "test-only stub"/);
  // A forged "matt" row with a reel that is not in the checkout, or no date, is refused by the committed rules.
  const forged = (over) => ({ ...realReg, line_draw_riding_dot: { ...realReg.line_draw_riding_dot, status: 'approved', approved_by: 'matt', approved_on: '2026-10-14', reel: 'out/studio/reels/never.mp4', ...over } });
  assert.match(fails(pb(), forged({}), {}), /reel out\/studio\/reels\/never\.mp4 is not a file in this checkout/);
  assert.match(fails(pb(), forged({ approved_on: 'today', reel: 'lib/studio/qa/fixtures/test-only-reel.txt' }), {}), /no approved_on ISO date/);
  assert.match(fails(pb(), forged({ reel: 'https://reels.example.com/x.mp4' }), {}), /was not HEAD-checked/);
  assert.match(fails(pb(), forged({ reel: 'https://reels.example.com/x.mp4' }), { reels: new Map([['line_draw_riding_dot', false]]) }), /did not answer a HEAD request/);
  assert.equal(fails(pb(), forged({ reel: 'https://reels.example.com/x.mp4' }), { reels: new Map([['line_draw_riding_dot', true]]) }), '');
});
test('creative: the piece brief is required, each field non-empty and at most 200 characters', () => {
  const none = pb(); delete none.creative;
  assert.match(fails(none), /needs a "creative" block/);
  for (const k of ['feel', 'constraint', 'lineage', 'one_sentence']) {
    const b = pb(); b.creative[k] = '  ';
    assert.match(fails(b), new RegExp(`creative\\.${k} is empty`));
  }
  const long = pb(); long.creative.lineage = 'x'.repeat(201);
  assert.match(fails(long), /creative\.lineage runs 201 characters/);
});
test('spec rules: each mandatory rule blocks', () => {
  const cases = [
    [(b) => { delete b.spec_rules; }, /spec_rules/],
    [(b) => { b.spec_rules.hook_by_s = 3; }, /hook_by_s/],
    [(b) => { b.spec_rules.loopable = false; }, /loopable/],
    [(b) => { b.spec_rules.real_numbers_count = 3; }, /1 or 2/],
    [(b) => { b.spec_rules.voiceover.voice = 'male'; }, /female/],
    [(b) => { b.spec_rules.captions.style = 'plain'; }, /TikTok/],
    [(b) => { b.spec_rules.voiceover.script = 'Prices fell 7% <break time="1s"/>'; }, /break tags/],
    [(b) => { b.spec_rules.end_card_sequence = ['logo', 'Call now 541.703.3095']; }, /End card must be/],
    [(b) => { b.spec_rules.topic_cta = { text: 'Get the report', placement: 'end_card' }; }, /own card/],
    [(b) => { b.techniques = ['made_up']; }, /not in techniques/],
    [(b) => { b.techniques = ['subframe_motion_blur']; }, /is planned, not built yet/],
    [(b) => { b.caption = 'Bend top team'; }, /Top team/i],
  ];
  for (const [mut, re] of cases) { const b = pb(); mut(b); assert.match(fails(b), re); }
});
test('registry: every technique has a recipe file', () => {
  const reg = JSON.parse(readFileSync(join(here, '..', '..', 'techniques', 'registry.json'), 'utf8')).techniques;
  for (const [n, v] of Object.entries(reg)) assert.ok(readFileSync(join(here, '..', '..', 'techniques', v.file), 'utf8').includes('## Recipe'), n);
});

test('footage rights list: Snowdrift is cleared for ads, unknown sources fail', () => {
  const b = pb(); b.special_ad_category = 'housing'; b.footage.push({ kind: 'stock_licensed', path: 'assets/Area Guide - Bend - 03.JPG', rights: 'licensed' });
  assert.doesNotMatch(fails(b), /footage_rights|not cleared/);
  const c = pb(); c.footage.push({ kind: 'stock_licensed', path: 'x.mp4', rights: 'licensed', source: 'random_vendor' });
  assert.match(fails(c), /not in rights\/footage_rights.json/);
});

const E2 = "Moving up? Okay, so here's the thing. Same ten thousand dollars. Two ways to use it. Off the price? About fifty-five dollars a month. As a seller concession, toward your rate? About one hundred sixty-nine dollars a month. Honestly, that's a big gap. We'll run your numbers.";
test('spoken voice: E2 conversational VO passes', () => {
  assert.deepEqual(spokenVoiceCheck(E2), []);
});
test('spoken voice: prose/ad script fails with clear reasons', () => {
  const ad = "Introducing an unparalleled opportunity nestled in the heart of Bend; this residence boasts sweeping views (and more). It is the dream home that buyers have been waiting for, and it is available now for a limited time. Furthermore, homeowners will utilize the expansive kitchen, which does not compromise on quality or craftsmanship or finish or light or space in any way whatsoever for the family. Act now.";
  const r = spokenVoiceCheck(ad).join('\n');
  for (const re of [/contractions/, /Sentence \d+ runs/, /Ad cliche "introducing"/, /Ad cliche "dream home"/, /Ad cliche "act now"/, /Written-only word "furthermore"/, /Written-only word "utilize"/, /Semicolon/, /Parentheses/, /No "you"/]) assert.match(r, re);
});
test('spoken voice: the gate blocks a brief with a prose VO, and with no VO', () => {
  const b = pb(); b.spec_rules.voiceover.script = "Furthermore, it is important to note that inventory is rising; buyers will benefit.";
  assert.match(fails(b), /Spoken voice/);
  const c = pb(); delete c.spec_rules.voiceover.script;
  assert.match(fails(c), /script is required/);
});

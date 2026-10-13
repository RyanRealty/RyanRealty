// Run: node --test tools/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const gate = join(here, '..', 'video_gate.mjs');
const run = (n) => spawnSync(process.execPath, [gate, join(here, 'fixtures', `${n}.brief.json`), join(here, 'fixtures', `${n}.timeline.json`)], { encoding: 'utf8' });

test('compliant market update passes', () => {
  const r = run('pass');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /VIDEO GATE PASSED/);
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
const load = (f) => JSON.parse(readFileSync(join(here, 'fixtures', f), 'utf8'));
const cfg = JSON.parse(readFileSync(join(here, '..', 'video_types.json'), 'utf8'));
const pb = () => load('pass.brief.json'), pt = load('pass.timeline.json');
const fails = (b) => g(b, pt, cfg).fails.join('\n');
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
    [(b) => { b.techniques = ['eased_number_reveal']; }, /is planned, not built yet/],
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

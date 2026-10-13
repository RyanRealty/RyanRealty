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
import { gate as g } from '../video_gate.mjs';
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
    [(b) => { b.caption = 'Bend top team'; }, /Top team/i],
  ];
  for (const [mut, re] of cases) { const b = pb(); mut(b); assert.match(fails(b), re); }
});
test('registry: every technique has a recipe file', () => {
  const reg = JSON.parse(readFileSync(join(here, '..', '..', 'techniques', 'registry.json'), 'utf8')).techniques;
  for (const [n, v] of Object.entries(reg)) assert.ok(readFileSync(join(here, '..', '..', 'techniques', v.file), 'utf8').includes('## Recipe'), n);
});

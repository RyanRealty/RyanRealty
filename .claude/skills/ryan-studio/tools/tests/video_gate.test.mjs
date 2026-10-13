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
  for (const re of [/Hook lands at 3.5s/, /First beat is "intro"/, /No payoff/, /Last beat must be the locked end card/, /hard max/, /holds 1.5s/, /safe area/, /3 different numbers/, /no row in brief.numbers/, /rights are unclear/, /restyled/, /house numbers/, /Em or en dash/, /Banned phrase "dream home"/, /Banned phrase "discover"/, /address/, /Fair housing flag/, /special_ad_category/, /persona/, /Exclamation/]) assert.match(r.stdout, re);
});

test('usage error exits 2', () => {
  const r = spawnSync(process.execPath, [gate], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});

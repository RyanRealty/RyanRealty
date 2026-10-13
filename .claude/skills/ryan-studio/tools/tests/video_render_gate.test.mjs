// Delivery chokepoint: deliver_video.sh must refuse a file without a matching render-gate pass stamp.
// (The OCR gate itself is tested by test_video_render_gate.py where tesseract + ffmpeg exist.)
import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const sh = join(dirname(fileURLToPath(import.meta.url)), '..', 'deliver_video.sh');
const d = mkdtempSync(join(tmpdir(), 'rg-')); const f = join(d, 'v.mp4'); writeFileSync(f, 'fake video');
const run = () => spawnSync('bash', [sh, f, join(d, 'out.mp4')], { encoding: 'utf8' });
test('refuses with no stamp', () => { const r = run(); assert.notStrictEqual(r.status, 0); assert.match(r.stderr, /REFUSED/); });
test('refuses with a stale stamp', () => { writeFileSync(f + '.gate.json', JSON.stringify({ pass: true, sha256: 'deadbeef' })); assert.notStrictEqual(run().status, 0); });
test('refuses a failing stamp', () => { const h = createHash('sha256').update('fake video').digest('hex'); writeFileSync(f + '.gate.json', JSON.stringify({ pass: false, sha256: h })); assert.notStrictEqual(run().status, 0); });
test('delivers only with a matching pass stamp', () => { const h = createHash('sha256').update('fake video').digest('hex'); writeFileSync(f + '.gate.json', JSON.stringify({ pass: true, sha256: h })); assert.strictEqual(run().status, 0); });

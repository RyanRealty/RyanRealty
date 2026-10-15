// video_render_gate.py CTA_WORDS must match whole words only: OCR noise off plain footage
// ("Tag tape") must not fail the end card, while a real "tap" CTA still does (E2 v12, 2026-10-14).
// Reads the pattern from the .py source so CI needs no opencv/tesseract.
import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'video_render_gate.py'), 'utf8')
const m = src.match(/^CTA_WORDS = re\.compile\(r"(.*)", re\.I\)$/m)
assert.ok(m, 'CTA_WORDS definition found')
const CTA = new RegExp(m[1], 'i')
test('junk OCR containing "tape" is not a CTA', () => {
  assert.strictEqual(CTA.test('Sead muerte y A Ye Tag tape eee A Oe * Be Sg'), false)
  assert.strictEqual(CTA.test('revisitation scheduled'), false)
})
test('a real "tap" CTA still trips it', () => {
  assert.strictEqual(CTA.test('Tap to call'), true)
  assert.strictEqual(CTA.test("We'll run your numbers."), true)
  assert.strictEqual(CTA.test('Swipe up'), true)
})

/**
 * Every envelope and OREF packet action checks the deal file is the caller's.
 * Before 2026-09-30 the writes checked only the role, so any broker could send,
 * edit or void another broker's envelope by id. The reads already scoped with
 * dealVisibleToBroker; the writes now call dealFileInScope. This reads the
 * action files so a new export that skips the check fails here.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FILES = ['app/actions/tc-envelopes.ts', 'app/actions/tc-oref-packet.ts']

/** Each exported async function's name and body, up to the next top-level declaration. */
function exportedBodies(src: string): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = []
  const re = /^export async function (\w+)\s*\(/gm
  const starts = [...src.matchAll(re)]
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i]!.index!
    const rest = src.slice(from + 1)
    const next = rest.search(/^(export |async function |function |const |type |\/\*\*)/m)
    out.push({ name: starts[i]![1]!, body: next < 0 ? rest : rest.slice(0, next) })
  }
  return out
}

describe('envelope and packet actions stay inside the caller\'s deal files', () => {
  for (const file of FILES) {
    const actions = exportedBodies(readFileSync(join(process.cwd(), file), 'utf8'))
    it(`${file} exports actions`, () => {
      expect(actions.length).toBeGreaterThan(0)
    })
    for (const { name, body } of actions) {
      it(`${file} ${name} checks the deal file's scope`, () => {
        expect(/dealFileInScope\(|dealVisibleToBroker\(/.test(body)).toBe(true)
      })
    }
  }
})

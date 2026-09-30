import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * public/rr-doc-tracker.js is served as-is to whatever browser opens an email, and
 * a SyntaxError is the one failure its own try/catch cannot catch: the whole script
 * dies at parse time and nothing is recorded (no page view, no identity stitch, the
 * person token left in the address bar). Its header promises ES5 syntax; this holds
 * it. A trailing comma in a call (ES2017) had slipped in with the click listener and
 * the header, when rewritten, claimed ES5 anyway.
 *
 * The parser is espree, the one eslint ships (a devDependency): with ecmaVersion 5 it
 * refuses every later syntax.
 */
const requireFromHere = createRequire(import.meta.url)
const espree = requireFromHere('espree') as { parse: (code: string, options: Record<string, unknown>) => unknown }

const parseAsEs5 = (code: string) => espree.parse(code, { ecmaVersion: 5, sourceType: 'script' })

describe('public/rr-doc-tracker.js is written in ES5 syntax', () => {
  const source = readFileSync(join(process.cwd(), 'public/rr-doc-tracker.js'), 'utf8')

  it('parses as ES5', () => {
    expect(() => parseAsEs5(source)).not.toThrow()
  })

  it('the parser does refuse what the script must not use, so this test can fail', () => {
    expect(() => parseAsEs5('f(a, b,)')).toThrow() // a trailing comma in a call, ES2017
    expect(() => parseAsEs5('var f = function () {}; var g = () => 1')).toThrow() // arrow function
    expect(() => parseAsEs5('let a = 1')).toThrow()
    expect(() => parseAsEs5('const a = 1')).toThrow()
    expect(() => parseAsEs5('var a = `x`')).toThrow() // template string
    expect(() => parseAsEs5('var a = { ...b }')).toThrow() // object spread
    expect(() => parseAsEs5('var a = { b: 1, }')).not.toThrow() // an object trailing comma is ES5
  })
})

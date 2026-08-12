import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { V3Sheet } from '@/components/site/v3'

/**
 * Capture-contract locks for the /oregon/[city] referral.
 *
 * WHY THIS FILE EXISTS. The migration of this route off the KB register silently
 * dropped one of the five keys the server action reads: `company`, the honeypot.
 * app/actions/out-of-area-referral.ts has no rate limit and no captcha, so that
 * key's branch, `if (input.company?.trim()) return { ok: true }`, is the only
 * thing standing between a scripted POST and a real crm_people row, an origin
 * note, a 240-minute broker task, and a queued SMS to a broker's phone. The
 * deletion was declared in prose and in the parity contract, and prose is exactly
 * what failed to stop it. These tests are the mechanical half.
 *
 * Two things are locked, in the two places they can break:
 *   1. The barrel still renders a trap that is invisible, unfocusable, and out of
 *      the accessibility tree, under the name the caller asked for.
 *   2. This route still asks for one, and still sends all five keys.
 *
 * No DOM library in this repo, so the render assertions are renderToStaticMarkup
 * plus attribute checks, the same approach as
 * components/site/__tests__/listing-detail-a11y.test.tsx, and the wiring
 * assertions read the TypeScript AST rather than grepping text.
 *
 * It lives here rather than beside the route because vitest.config.ts collects
 * components/site/__tests__ and does not collect app/oregon.
 */

const SHEET_FILE = join(
  process.cwd(),
  'app/oregon/[city]/_v3/OutOfAreaReferralSheet.client.tsx',
)

/** The keys app/actions/out-of-area-referral.ts reads off its input. */
const CAPTURE_KEYS = ['citySlug', 'name', 'email', 'notes', 'company'] as const

function parse(file: string): ts.SourceFile {
  const src = readFileSync(file, 'utf8')
  return ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function walk(node: ts.Node, visit: (n: ts.Node) => void) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

describe('V3Sheet trap (the barrel half)', () => {
  const markup = renderToStaticMarkup(
    createElement(V3Sheet, {
      heading: 'Get a broker introduction',
      trap: { name: 'company', label: 'Company' },
      steps: [
        {
          id: 'email',
          label: 'Where should the introduction go?',
          field: { kind: 'email', name: 'email', label: 'Email' },
          advanceLabel: 'Connect me',
        },
      ],
    }),
  )

  it('renders a control under the trap name', () => {
    expect(markup).toContain('name="company"')
  })

  it('keeps the trap out of the accessibility tree and out of the tab order', () => {
    const trap = /<div class="v3-sheet-trap"[^>]*>[\s\S]*?<\/div>/.exec(markup)?.[0] ?? ''
    expect(trap).not.toBe('')
    expect(trap).toContain('aria-hidden="true"')
    expect(trap).toContain('tabindex="-1"')
    // A name element is still built, so the control boundary holds literally.
    expect(trap).toContain('<label')
  })

  it('leaves the step its one visible question', () => {
    expect(markup).toContain('Where should the introduction go?')
    expect(markup).toContain('type="email"')
  })

  it('drops a trap whose name a real question already answers under', () => {
    const collided = renderToStaticMarkup(
      createElement(V3Sheet, {
        heading: 'Get a broker introduction',
        trap: { name: 'email', label: 'Company' },
        steps: [
          {
            id: 'email',
            label: 'Where should the introduction go?',
            field: { kind: 'email', name: 'email', label: 'Email' },
            advanceLabel: 'Connect me',
          },
        ],
      }),
    )
    expect(collided).not.toContain('v3-sheet-trap')
  })

  it('renders no trap when the caller asks for none', () => {
    const bare = renderToStaticMarkup(
      createElement(V3Sheet, {
        heading: 'Get a broker introduction',
        steps: [
          {
            id: 'email',
            label: 'Where should the introduction go?',
            field: { kind: 'email', name: 'email', label: 'Email' },
            advanceLabel: 'Connect me',
          },
        ],
      }),
    )
    expect(bare).not.toContain('v3-sheet-trap')
  })
})

describe('OutOfAreaReferralSheet (the route half)', () => {
  const sf = parse(SHEET_FILE)

  it('sends every key the server action reads, and no invented ones', () => {
    let sent: string[] | null = null
    walk(sf, (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'submitOutOfAreaReferral' &&
        node.arguments[0] &&
        ts.isObjectLiteralExpression(node.arguments[0])
      ) {
        sent = (node.arguments[0] as ts.ObjectLiteralExpression).properties.flatMap((p) =>
          p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? [p.name.text] : [],
        )
      }
    })
    expect(sent, 'no submitOutOfAreaReferral({...}) call found').not.toBeNull()
    expect([...(sent as unknown as string[])].sort()).toEqual([...CAPTURE_KEYS].sort())
  })

  it('asks V3Sheet for the honeypot under the key the action reads', () => {
    let trapName: string | null = null
    walk(sf, (node) => {
      if (!ts.isJsxAttribute(node)) return
      if (node.name.getText() !== 'trap') return
      const init = node.initializer
      if (!init || !ts.isJsxExpression(init) || !init.expression) return
      if (!ts.isObjectLiteralExpression(init.expression)) return
      for (const prop of init.expression.properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          prop.name.getText() === 'name' &&
          ts.isStringLiteral(prop.initializer)
        ) {
          trapName = prop.initializer.text
        }
      }
    })
    expect(trapName, 'V3Sheet is rendered without a trap prop').toBe('company')
  })
})

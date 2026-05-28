/**
 * Local ESLint plugin: rr-no-dynamic-revalidate
 *
 * Single rule `no-dynamic-revalidate` blocks `export const dynamic =
 * 'force-dynamic'` from coexisting with `export const revalidate = N`
 * (or `export async function generateMetadata(...) { revalidate: N }`)
 * in the same App Router route file.
 *
 * Why: per EXECUTION_PLAN §0.4 the combination silently breaks ISR
 * caching. `force-dynamic` disables Next.js's static + cached render
 * path; `revalidate` is meaningless once dynamic-rendering is in
 * play. Routes carrying both ship a cold render on every request
 * while the developer assumes the revalidate setting is in effect.
 * The bug is invisible until production p95 TTFB starts climbing.
 *
 * Scope: applied via `files` filter in eslint.config.mjs to
 * app/<route>/page.tsx, layout.tsx, and route.ts only.
 *
 * Closes GAP-5 from out/guardrail-inventory-2026-05-28.md.
 */

'use strict'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Block `export const dynamic = "force-dynamic"` from coexisting with `export const revalidate = N` in the same App Router file. The combination silently disables ISR caching.',
    },
    schema: [],
    messages: {
      coexistence:
        'G18: `export const dynamic = "force-dynamic"` and `export const revalidate = N` (line {{revalidateLine}}) cannot coexist in the same route file. force-dynamic disables every caching layer — making revalidate a no-op while masking the cold-render cost. Pick one: drop the revalidate export (force-dynamic only), or drop the dynamic export and rely on revalidate alone.',
    },
  },

  create(context) {
    const found = {
      dynamicForce: null,
      revalidate: null,
    }

    function isStringLit(node, value) {
      return (
        node &&
        node.type === 'Literal' &&
        typeof node.value === 'string' &&
        node.value === value
      )
    }

    function isNumberLit(node) {
      return (
        node &&
        node.type === 'Literal' &&
        typeof node.value === 'number' &&
        Number.isFinite(node.value)
      )
    }

    function checkDeclaration(node) {
      if (
        node.type !== 'ExportNamedDeclaration' ||
        !node.declaration ||
        node.declaration.type !== 'VariableDeclaration'
      ) {
        return
      }
      for (const d of node.declaration.declarations) {
        if (d.id?.type !== 'Identifier') continue
        if (d.id.name === 'dynamic') {
          if (isStringLit(d.init, 'force-dynamic')) {
            found.dynamicForce = d
          }
        } else if (d.id.name === 'revalidate') {
          if (isNumberLit(d.init) && d.init.value > 0) {
            found.revalidate = d
          }
        }
      }
    }

    return {
      ExportNamedDeclaration: checkDeclaration,

      'Program:exit'(_node) {
        if (found.dynamicForce && found.revalidate) {
          context.report({
            node: found.dynamicForce,
            messageId: 'coexistence',
            data: {
              revalidateLine: found.revalidate.loc?.start?.line ?? '?',
            },
          })
        }
      },
    }
  },
}

module.exports = {
  meta: { name: 'rr-no-dynamic-revalidate', version: '1.0.0' },
  rules: {
    'no-dynamic-revalidate': rule,
  },
}

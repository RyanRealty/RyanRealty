/**
 * B4 (Phase 11B, Matt 2026-08-06) — the admin shell carries NO public brand.
 *
 * ADMIN_UI.md §5 amnesia rule: no wordmark image, no navy brand bar — the admin
 * is its own product. The phone wordmark header in ConsoleShell was chrome leak
 * and was removed; this test proves at the AST level (repo canon: code-inspecting
 * checks parse, never regex-only) that:
 *
 *   1. ConsoleShell declares/imports no `Wordmark` and references no brand
 *      logo asset in any string literal.
 *   2. The locked 5-tab bar (CrmMobileTabBar) mounts as a JSX element.
 *   3. Exactly ONE ConsoleCommandPalette mounts (one ⌘K listener, one dialog —
 *      audit §9.2), so removing the header did not delete palette capability.
 *
 * B5 (Phase 11B): the desktop chrome migrated to the LOCKED §5 Option A left
 * rail. Additional pins:
 *
 *   4. RailNav mounts as a JSX element inside an lg-gated wrapper (desktop-only).
 *   5. The retired CRM-style top bar (ConsoleTopNav — navy brand bar + white
 *      public wordmark) is GONE: not referenced by the shell, file deleted.
 *   6. No file under components/console/ carries a public wordmark path or the
 *      brand navy hex.
 *
 * Static-source companion to scripts/check-admin-mobile-shell.mjs (which greps);
 * this walks the parsed tree so a renamed import or aliased JSX tag cannot slip
 * a wordmark back in.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import ts from 'typescript'

const SHELL_PATH = fileURLToPath(new URL('../../components/console/ConsoleShell.tsx', import.meta.url))
const CONSOLE_DIR = fileURLToPath(new URL('../../components/console', import.meta.url))
const TOPNAV_PATH = join(CONSOLE_DIR, 'ConsoleTopNav.tsx')

function parseShell() {
  const src = readFileSync(SHELL_PATH, 'utf8')
  return ts.createSourceFile(SHELL_PATH, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/** Every string literal (incl. template strings) in the file. */
function stringLiterals(sf: ts.SourceFile): string[] {
  const out: string[] = []
  const walk = (n: ts.Node) => {
    if (ts.isStringLiteralLike(n)) out.push(n.text)
    if (ts.isTemplateExpression(n)) {
      out.push(n.head.text)
      for (const span of n.templateSpans) out.push(span.literal.text)
    }
    n.forEachChild(walk)
  }
  walk(sf)
  return out
}

/** Tag names of every JSX opening/self-closing element. */
function jsxTags(sf: ts.SourceFile): string[] {
  const out: string[] = []
  const walk = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) out.push(n.tagName.getText(sf))
    n.forEachChild(walk)
  }
  walk(sf)
  return out
}

/**
 * className strings on every JSX ancestor of the first element whose tag
 * matches `tag` (walks node.parent — parse created with setParentNodes=true).
 */
function ancestorClassNames(sf: ts.SourceFile, tag: string): string[] {
  let target: ts.Node | undefined
  const find = (n: ts.Node) => {
    if (target) return
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(sf) === tag) {
      target = n
      return
    }
    n.forEachChild(find)
  }
  find(sf)
  const out: string[] = []
  for (let n: ts.Node | undefined = target; n; n = n.parent) {
    const opening = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : undefined
    if (!opening) continue
    for (const attr of opening.attributes.properties) {
      if (
        ts.isJsxAttribute(attr) &&
        attr.name.getText(sf) === 'className' &&
        attr.initializer &&
        ts.isStringLiteral(attr.initializer)
      ) {
        out.push(attr.initializer.text)
      }
    }
  }
  return out
}

/** Every identifier declared or imported in the file. */
function declaredNames(sf: ts.SourceFile): string[] {
  const out: string[] = []
  const walk = (n: ts.Node) => {
    if (ts.isFunctionDeclaration(n) && n.name) out.push(n.name.text)
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) out.push(n.name.text)
    if (ts.isImportSpecifier(n)) out.push(n.name.text)
    if (ts.isImportClause(n) && n.name) out.push(n.name.text)
    n.forEachChild(walk)
  }
  walk(sf)
  return out
}

describe('ConsoleShell amnesia (ADMIN_UI §5: the admin carries no public brand)', () => {
  const sf = parseShell()

  it('declares and imports no Wordmark', () => {
    expect(declaredNames(sf)).not.toContain('Wordmark')
    expect(jsxTags(sf)).not.toContain('Wordmark')
  })

  it('references no brand logo asset in any string literal', () => {
    const offenders = stringLiterals(sf).filter(
      (s) => s.includes('logo-horizontal') || s.includes('/images/brand/') || s.includes('logo-blue'),
    )
    expect(offenders).toEqual([])
  })

  it('mounts the locked 5-tab bar (CrmMobileTabBar)', () => {
    expect(jsxTags(sf)).toContain('CrmMobileTabBar')
  })

  it('mounts exactly one ConsoleCommandPalette (one ⌘K listener, one dialog)', () => {
    expect(jsxTags(sf).filter((t) => t === 'ConsoleCommandPalette')).toHaveLength(1)
  })

  it('mounts the §5 left rail (RailNav) inside an lg-gated wrapper (B5)', () => {
    expect(jsxTags(sf)).toContain('RailNav')
    // The rail is desktop chrome: some JSX ancestor must hide it below lg.
    const classes = ancestorClassNames(sf, 'RailNav')
    expect(
      classes.some((c) => /\bhidden\b/.test(c) && /\blg:(flex|block|grid)\b/.test(c)),
    ).toBe(true)
  })

  it('the retired navy top bar (ConsoleTopNav) is gone (B5)', () => {
    expect(declaredNames(sf)).not.toContain('ConsoleTopNav')
    expect(jsxTags(sf)).not.toContain('ConsoleTopNav')
    expect(existsSync(TOPNAV_PATH)).toBe(false)
  })

  it('no file under components/console/ carries a wordmark path or the brand navy hex (B5)', () => {
    const offenders: string[] = []
    for (const name of readdirSync(CONSOLE_DIR)) {
      const src = readFileSync(join(CONSOLE_DIR, name), 'utf8')
      for (const banned of ['logo-horizontal', '/images/brand/', 'logo-blue', '102742']) {
        if (src.includes(banned)) offenders.push(`${name}: ${banned}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

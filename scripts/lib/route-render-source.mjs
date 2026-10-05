/**
 * route-render-source.mjs — the source a source-reading gate should judge for a
 * route file, when the route renders through a SHARED RENDER MODULE.
 *
 * Convention (2026-10-05, blog draft preview): a route may move its body into a
 * `render-*.ts(x)` module in its own folder or its own `_v3/` folder, so a
 * second surface (the login-only admin preview) renders the same thing. The
 * route file keeps metadata, ISR and its data read; the module keeps the JSX.
 * A gate that reads page.tsx text would then see an empty page, so it reads
 * this instead: the route source, followed by the source of every render module
 * the route file itself imports. A render module the route does not import adds
 * nothing, so deleting the call cannot keep a gate green.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const RENDER_IMPORT = /from\s+['"](\.\/(?:_v3\/)?render-[A-Za-z0-9-]+)['"]/g
const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js']

/**
 * @param {string} absRoutePath absolute path of the route file
 * @param {string} [src] its source, when the caller already read it
 * @returns {string} route source + each imported render module's source
 */
export function routeRenderSource(absRoutePath, src = readFileSync(absRoutePath, 'utf8')) {
  let out = src
  const seen = new Set()
  for (const m of src.matchAll(RENDER_IMPORT)) {
    const spec = m[1]
    if (seen.has(spec)) continue
    seen.add(spec)
    const base = join(dirname(absRoutePath), spec)
    const file = EXTENSIONS.map((ext) => base + ext).find((f) => existsSync(f))
    if (file) out += '\n' + readFileSync(file, 'utf8')
  }
  return out
}

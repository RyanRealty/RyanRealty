#!/usr/bin/env node
/**
 * Matt 2026-09-13: Vercel Image Optimization must stay off.
 * Refuses a next.config without images.unoptimized: true.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const cfg = readFileSync(resolve(process.cwd(), 'next.config.ts'), 'utf8')
const imagesBlock = cfg.match(/images:\s*\{([\s\S]*?)\n  \},/)
if (!imagesBlock) {
  console.error('check-images-unoptimized: could not find images: { ... } in next.config.ts')
  process.exit(1)
}
const body = imagesBlock[1]
if (!/\bunoptimized:\s*true\b/.test(body)) {
  console.error('check-images-unoptimized: FAIL — images.unoptimized must be true (Matt 2026-09-13)')
  process.exit(1)
}
console.log('check-images-unoptimized: OK (images.unoptimized: true)')

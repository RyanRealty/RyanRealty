/**
 * Launch headless Chromium the same way in every runtime: the
 * @sparticuz/chromium-min pack on Vercel (downloaded into /tmp), a local
 * Chrome everywhere else. lib/pdf/html-to-pdf.ts and lib/cma-pdf.ts still
 * carry their own copies of this; new renderers launch through here.
 *
 * puppeteer-core and chromium-min are serverExternalPackages, loaded from
 * node_modules at runtime, so any function that reaches this module must
 * trace them (next.config.ts outputFileTracingIncludes) or load it lazily.
 */
import puppeteer, { type Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'
import { CHROMIUM_REMOTE } from './chromium-remote'

export function isServerlessRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME)
}

export function localChromePath(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.PUPPETEER_EXECUTABLE_PATH ||
    env.CHROME_PATH ||
    (process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : '/usr/bin/google-chrome')
  )
}

export async function launchChromium(options: {
  viewport: { width: number; height: number }
  args?: string[]
}): Promise<Browser> {
  const extra = options.args ?? []
  const defaultViewport = { ...options.viewport, deviceScaleFactor: 1 }
  if (isServerlessRuntime()) {
    return puppeteer.launch({
      args: [...chromium.args, ...extra],
      defaultViewport,
      executablePath: await chromium.executablePath(CHROMIUM_REMOTE),
      headless: true,
    })
  }
  return puppeteer.launch({
    executablePath: localChromePath(),
    headless: true,
    defaultViewport,
    args: ['--no-sandbox', '--disable-setuid-sandbox', ...extra],
  })
}

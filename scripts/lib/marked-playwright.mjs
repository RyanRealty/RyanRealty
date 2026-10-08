/**
 * marked-playwright.mjs — Playwright, with every context carrying our automation
 * marker (scripts/lib/automation-marker.mjs). Import from here, never from
 * 'playwright' directly (`ci:analytics-suppression`):
 *
 *   import { chromium, devices } from './lib/marked-playwright.mjs'
 *
 * Same API: `launch`, `launchPersistentContext`, `connectOverCDP` and `connect`
 * return the real objects; every context they hand out (including the one
 * `browser.newPage()` creates) gets rr_automation=1, rr_internal=1 and a
 * declined consent cookie before the caller can navigate it.
 */
import * as playwright from 'playwright'
import { isOwnSiteHost, markerCookies, plantFlagsScript } from './automation-marker.mjs'

function wrapPage(page) {
  if (page.__rrGotoWrapped) return page
  page.__rrGotoWrapped = true
  const origGoto = page.goto.bind(page)
  page.goto = async (url, ...rest) => {
    if (url) {
      try {
        const host = new URL(String(url), 'http://127.0.0.1').hostname
        if (isOwnSiteHost(host)) await page.context().addCookies(markerCookies([host]))
      } catch {
        /* a relative or invalid URL still navigates; cookies are already on the context */
      }
    }
    return origGoto(url, ...rest)
  }
  return page
}

async function mark(context) {
  if (!context.__rrMarked) {
    context.__rrMarked = true
    try {
      await context.addCookies(markerCookies())
    } catch (err) {
      console.warn('[marked-playwright] could not set the automation marker:', err?.message ?? err)
    }
    try {
      await context.addInitScript({ content: plantFlagsScript() })
    } catch (err) {
      console.warn('[marked-playwright] could not plant page flags:', err?.message ?? err)
    }
    const origNewPage = context.newPage.bind(context)
    context.newPage = async (...args) => wrapPage(await origNewPage(...args))
    for (const page of context.pages()) wrapPage(page)
  } else {
    try {
      await context.addCookies(markerCookies())
    } catch {
      /* already marked; a second pass is best-effort */
    }
  }
  return context
}

function wrapBrowser(browser) {
  const newContext = browser.newContext.bind(browser)
  const newPage = browser.newPage.bind(browser)
  browser.newContext = async (...args) => mark(await newContext(...args))
  browser.newPage = async (...args) => {
    const page = await newPage(...args)
    await mark(page.context())
    return wrapPage(page)
  }
  return browser
}

function wrapBrowserType(browserType) {
  return new Proxy(browserType, {
    get(target, key) {
      if (key === 'launch') return async (...args) => wrapBrowser(await target.launch(...args))
      if (key === 'launchPersistentContext') return async (...args) => mark(await target.launchPersistentContext(...args))
      if (key === 'connectOverCDP' || key === 'connect') {
        return async (...args) => {
          const browser = wrapBrowser(await target[key](...args))
          for (const context of browser.contexts()) await mark(context)
          return browser
        }
      }
      const value = Reflect.get(target, key)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

export const chromium = wrapBrowserType(playwright.chromium)
export const firefox = wrapBrowserType(playwright.firefox)
export const webkit = wrapBrowserType(playwright.webkit)
export const devices = playwright.devices
export const errors = playwright.errors
export { markContext }
async function markContext(context) {
  return mark(context)
}
export default { chromium, firefox, webkit, devices, errors }

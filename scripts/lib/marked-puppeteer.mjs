/**
 * marked-puppeteer.mjs — puppeteer-core, with every browser and context carrying
 * our automation marker (scripts/lib/automation-marker.mjs). Import from here,
 * never from 'puppeteer' / 'puppeteer-core' directly (`ci:analytics-suppression`):
 *
 *   import puppeteer from './lib/marked-puppeteer.mjs'
 *
 * `launch` and `connect` return the real Browser with the marker cookie set on
 * its default context; `createBrowserContext` marks each new context too.
 */
import puppeteerCore from 'puppeteer-core'
import { markerCookies } from './automation-marker.mjs'

async function mark(target) {
  try {
    await target.setCookie(...markerCookies())
  } catch (err) {
    console.warn('[marked-puppeteer] could not set the automation marker:', err?.message ?? err)
  }
  return target
}

async function wrapBrowser(browser) {
  await mark(browser)
  const createBrowserContext = browser.createBrowserContext?.bind(browser)
  if (createBrowserContext) {
    browser.createBrowserContext = async (...args) => mark(await createBrowserContext(...args))
  }
  return browser
}

const puppeteer = new Proxy(puppeteerCore, {
  get(target, key) {
    if (key === 'launch' || key === 'connect') return async (...args) => wrapBrowser(await target[key](...args))
    const value = Reflect.get(target, key)
    return typeof value === 'function' ? value.bind(target) : value
  },
})

export default puppeteer

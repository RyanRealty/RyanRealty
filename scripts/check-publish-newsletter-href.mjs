#!/usr/bin/env node
/**
 * Public /newsletter door must resolve to the newsletter subscribe surface.
 *
 * Founding cases:
 *   GET /newsletter 404 (fleet:71e7816c6d1dd62201a57fa480d7fd39)
 *   Dedicated /newsletter URL 404 while footer form works
 *     (fleet:c650b38778f7a41487262a461a617d6f)
 *
 *   node scripts/check-publish-newsletter-href.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/site/publish-newsletter-href.ts')
checks.push({
  label: 'publishNewsletterSubscribeHref publishes /newsletter and withholds listing alerts',
  ok:
    /export function publishNewsletterSubscribeHref/.test(helper) &&
    /export function publishNewsletterSubscribeDestination/.test(helper) &&
    /export function isNewsletterSubscribeHref/.test(helper) &&
    helper.includes("'/newsletter'") &&
    helper.includes("'/lp/buyer-listing-alerts'") &&
    helper.includes('71e7816c6d1dd62201a57fa480d7fd39') &&
    helper.includes('c650b38778f7a41487262a461a617d6f') &&
    helper.includes('Do not send'),
})

const page = src('app/newsletter/page.tsx')
checks.push({
  label: 'app/newsletter/page.tsx is the live subscribe door',
  ok:
    /from ['"]@\/lib\/site\/publish-newsletter-href['"]/.test(page) &&
    /publishNewsletterSubscribeHref\(\)/.test(page) &&
    /from ['"]\.\/_v3\/NewsletterSheet\.client['"]/.test(page) &&
    /<NewsletterSheet/.test(page) &&
    /V3SectionTracker/.test(page) &&
    /V3Footer/.test(page) &&
    page.includes('71e7816c6d1dd62201a57fa480d7fd39'),
})

const sheet = src('app/newsletter/_v3/NewsletterSheet.client.tsx')
checks.push({
  label: 'NewsletterSheet posts to subscribeNewsletterAction and does not send',
  ok:
    /from ['"]@\/app\/actions\/newsletter-subscribe['"]/.test(sheet) &&
    /subscribeNewsletterAction\(formData\)/.test(sheet) &&
    /readRrSessionId\(\) \/\/ hydration-safe/.test(sheet) &&
    /id="newsletter"/.test(sheet) &&
    /trap=\{\{ name: 'company'/.test(sheet) &&
    !/sendNewsletter|adminSendNewsletter/.test(sheet),
})

const redirects = src('next.config.ts')
checks.push({
  label: 'next.config does not rewrite /newsletter to listing alerts',
  ok:
    !/source:\s*['"]\/newsletter['"][\s\S]{0,200}buyer-listing-alerts/.test(redirects) &&
    !/source:\s*['"]\/newsletter['"][\s\S]{0,200}destination:\s*['"]\/lp\//.test(redirects),
})

const unsub = src('app/newsletter/unsubscribe/page.tsx')
checks.push({
  label: '/newsletter/unsubscribe stays a token-confirm utility',
  ok:
    /unsubscribeNewsletterByToken/.test(unsub) &&
    /robots:\s*\{\s*index:\s*false/.test(unsub),
})

const nav = src('lib/site-nav.ts')
checks.push({
  label: 'site-nav Market column publishes the /newsletter door',
  ok:
    /from ['"]@\/lib\/site\/publish-newsletter-href['"]/.test(nav) &&
    /publishNewsletterSubscribeHref\(\)/.test(nav) &&
    /label: 'Monthly briefing'/.test(nav),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-newsletter-href: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-newsletter-href: ${checks.length}/${checks.length}`)

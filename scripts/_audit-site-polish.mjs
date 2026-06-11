/**
 * Site polish audit crawler — 2026-06-10. AUDIT ONLY, writes out/audit-polish/*.
 * Usage: node scripts/_audit-site-polish.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const OUT = 'out/audit-polish';
fs.mkdirSync(OUT, { recursive: true });

const ANIMATIONS_OFF = '*, *::before, *::after { animation: none !important; transition: none !important; }';

const PAGES = [
  ['home', '/'],
  ['homes-for-sale', '/homes-for-sale'],
  ['homes-for-sale-bend', '/homes-for-sale/bend'],
  ['cities', '/cities'],
  ['cities-bend', '/cities/bend'],
  ['communities', '/communities'],
  ['communities-tetherow', '/communities/tetherow'],
  ['listing-detail', null], // resolved below
  ['sell', '/sell'],
  ['buy', '/buy'],
  ['about', '/about'],
  ['team', '/team'],
  ['housing-market', '/housing-market'],
  ['reports', '/reports'],
  ['price-drops', '/price-drops'],
  ['blog', '/blog'],
  ['blog-post', null],
  ['guides', '/guides'],
  ['guide-detail', null],
  ['open-houses', '/open-houses'],
  ['mortgage-calculator', '/tools/mortgage-calculator'],
  ['contact', '/contact'],
];

const browser = await chromium.launch();

async function resolveDynamic(page) {
  const out = {};
  // listing
  await page.goto(`${BASE}/homes-for-sale`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3500);
  out.listing = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href]')).find(a =>
      /^\/(homes-for-sale\/listing\/|listing\/)/.test(a.getAttribute('href') || ''));
    return a ? a.getAttribute('href') : null;
  });
  await page.goto(`${BASE}/blog`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);
  out.blog = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href^="/blog/"]')).find(a => a.getAttribute('href') !== '/blog');
    return a ? a.getAttribute('href') : null;
  });
  await page.goto(`${BASE}/guides`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);
  out.guide = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href^="/guides/"]')).find(a => a.getAttribute('href') !== '/guides');
    return a ? a.getAttribute('href') : null;
  });
  return out;
}

async function auditPage(context, name, path, viewport) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 400)); });
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 400)));
  page.on('requestfailed', r => failedRequests.push(`${r.failure()?.errorText} ${r.url()}`.slice(0, 300)));
  page.on('response', r => { if (r.status() >= 400) failedRequests.push(`HTTP ${r.status()} ${r.url()}`.slice(0, 300)); });

  const t0 = Date.now();
  let status = null;
  try {
    const resp = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    status = resp?.status();
  } catch (e) {
    await page.close();
    return { name, path, viewport: viewport.width, error: String(e).slice(0, 300) };
  }
  const domMs = Date.now() - t0;
  await page.addStyleTag({ content: ANIMATIONS_OFF }).catch(() => {});
  await page.waitForTimeout(6000); // let maps/hydration settle

  const data = await page.evaluate(() => {
    const res = {};
    // breadcrumb
    const navs = Array.from(document.querySelectorAll('nav[aria-label="Breadcrumb" i], nav[aria-label="breadcrumbs" i], .breadcrumb, [class*="breadcrumb" i]'))
      .filter(n => n.tagName === 'NAV' || n.querySelector('a'));
    res.breadcrumbs = navs.slice(0, 2).map(n => {
      const rect = n.getBoundingClientRect();
      const items = Array.from(n.querySelectorAll('li')).map(li => li.textContent.trim());
      const links = Array.from(n.querySelectorAll('a')).map(a => a.getAttribute('href'));
      const seps = Array.from(n.querySelectorAll('span[aria-hidden], svg')).map(s => s.tagName === 'SVG' ? '<svg>' : s.textContent.trim()).filter(Boolean);
      const cs = getComputedStyle(n);
      let bg = 'transparent'; let el = n;
      while (el && el !== document.body) {
        const b = getComputedStyle(el).backgroundColor;
        if (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') { bg = b; break; }
        el = el.parentElement;
      }
      return {
        top: Math.round(rect.top + window.scrollY), items, links,
        separators: [...new Set(seps)], fontSize: cs.fontSize, bg,
        lastIsLink: (() => { const lis = n.querySelectorAll('li'); return lis.length ? !!lis[lis.length - 1].querySelector('a') : null; })(),
        html: n.outerHTML.slice(0, 600),
      };
    });
    // h1
    const h1 = document.querySelector('h1');
    if (h1) {
      const cs = getComputedStyle(h1);
      res.h1 = { text: h1.textContent.trim().slice(0, 120), fontFamily: cs.fontFamily.split(',')[0], fontSize: cs.fontSize, fontWeight: cs.fontWeight, textTransform: cs.textTransform };
    }
    res.h1Count = document.querySelectorAll('h1').length;
    // h2 fonts
    const h2s = Array.from(document.querySelectorAll('h2')).slice(0, 30);
    const h2Fonts = {};
    h2s.forEach(h => { const f = getComputedStyle(h).fontFamily.split(',')[0] + ' @ ' + getComputedStyle(h).fontSize; h2Fonts[f] = (h2Fonts[f] || 0) + 1; });
    res.h2Fonts = h2Fonts;
    res.h2Texts = h2s.map(h => h.textContent.trim().slice(0, 70));
    // Amboqia usage count
    res.amboqiaEls = Array.from(document.querySelectorAll('h1,h2,h3,.font-display,[class*="display"]')).filter(e => /amboqia/i.test(getComputedStyle(e).fontFamily)).length;
    // maps
    const gm = document.querySelectorAll('.gm-style');
    res.map = {
      gmStyleCount: gm.length,
      gmTiles: document.querySelectorAll('.gm-style img').length,
      canvases: document.querySelectorAll('canvas').length,
      mapContainers: Array.from(document.querySelectorAll('[class*="map" i], [id*="map" i]')).filter(e => { const r = e.getBoundingClientRect(); return r.width > 200 && r.height > 150; }).length,
      gmAuthFailure: !!document.querySelector('.gm-err-container, .gm-err-content'),
      errorText: (document.body.innerText.match(/can't load Google Maps|something went wrong|map (failed|unavailable)|Oops/i) || [null])[0],
    };
    // overflow
    res.scrollWidth = document.scrollingElement.scrollWidth;
    res.clientWidth = document.scrollingElement.clientWidth;
    // images
    const imgs = Array.from(document.querySelectorAll('img'));
    res.imgsNoAlt = imgs.filter(i => !i.hasAttribute('alt')).length;
    res.imgsBroken = imgs.filter(i => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith('data:')).map(i => i.src.slice(0, 150)).slice(0, 8);
    // placeholder / junk text
    const body = document.body.innerText;
    res.junk = ['Lorem ipsum', 'placeholder', 'TODO', 'undefined', '$NaN', 'NaN%', ' null '].filter(t => body.includes(t));
    res.emDash = (body.match(/—/g) || []).length;
    // buttons + radii
    const btns = Array.from(document.querySelectorAll('button, a[class*="btn" i], a[class*="button" i]')).filter(b => { const r = b.getBoundingClientRect(); return r.width > 40 && r.height > 24; }).slice(0, 60);
    const radii = {};
    btns.forEach(b => { const r = getComputedStyle(b).borderRadius; radii[r] = (radii[r] || 0) + 1; });
    res.buttonRadii = radii;
    // containers
    const widths = {};
    document.querySelectorAll('main section > div, main > div, main section').forEach(d => {
      const mw = getComputedStyle(d).maxWidth;
      if (mw !== 'none') widths[mw] = (widths[mw] || 0) + 1;
    });
    res.containerMaxWidths = widths;
    // section vertical rhythm
    const pads = {};
    document.querySelectorAll('main section, main > div > section').forEach(s => {
      const p = getComputedStyle(s).paddingTop + '/' + getComputedStyle(s).paddingBottom;
      pads[p] = (pads[p] || 0) + 1;
    });
    res.sectionPaddings = pads;
    // empty sections
    res.emptySections = Array.from(document.querySelectorAll('main section')).filter(s => s.innerText.trim().length === 0 && !s.querySelector('img,canvas,svg,iframe')).length;
    // internal links for 404 sweep
    res.links = [...new Set(Array.from(document.querySelectorAll('header a[href^="/"], footer a[href^="/"], nav a[href^="/"]')).map(a => a.getAttribute('href').split('#')[0].split('?')[0]))];
    res.title = document.title;
    return res;
  }).catch(e => ({ evalError: String(e).slice(0, 300) }));

  const shotPath = `${OUT}/${name}-${viewport.width}.png`;
  try { await page.screenshot({ path: shotPath, fullPage: true }); } catch {}
  await page.close();
  return { name, path, viewport: viewport.width, status, domMs, consoleErrors: [...new Set(consoleErrors)].slice(0, 15), pageErrors: [...new Set(pageErrors)].slice(0, 10), failedRequests: [...new Set(failedRequests)].slice(0, 15), ...data, shot: shotPath };
}

const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36' });
const dynPage = await ctx.newPage();
await dynPage.setViewportSize({ width: 1440, height: 900 });
const dyn = await resolveDynamic(dynPage);
await dynPage.close();
console.log('dynamic:', JSON.stringify(dyn));

const results = [];
for (const [name, p] of PAGES) {
  let path = p;
  if (name === 'listing-detail') path = dyn.listing;
  if (name === 'blog-post') path = dyn.blog;
  if (name === 'guide-detail') path = dyn.guide;
  if (!path) { results.push({ name, error: 'no path resolved' }); continue; }
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    console.log(`auditing ${name} @ ${vp.width} (${path})`);
    const r = await auditPage(ctx, name, path, vp);
    results.push(r);
    fs.writeFileSync(`${OUT}/audit.json`, JSON.stringify(results, null, 2));
  }
}

await browser.close();
console.log('DONE — results at', `${OUT}/audit.json`);

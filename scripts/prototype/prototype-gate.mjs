#!/usr/bin/env node
/**
 * Prototype gate. Loads every page at phone width in a real browser and fails on
 * the three defects that keep reaching the client:
 *
 *   1. TEXT OVERFLOW   — any text box crossing the 390px frame. Caught by measuring
 *                        every text-bearing element's rect, not by eyeballing.
 *   2. DEAD CONTROL    — anything that looks pressable but changes nothing when
 *                        pressed. Found by snapshotting the DOM, clicking, and
 *                        diffing. The client's rule is that these get deleted, so
 *                        shipping one is a fail, not a note.
 *   3. QUIRKS MODE     — a missing doctype silently changes box sizing.
 *
 * Also reports console errors, which otherwise die inside the iframe unseen.
 *
 * Usage: node check.mjs [pageKey ...]     (no args = every page)
 */
import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGES = join(HERE, 'pages');
const WIDTH = 390;
const HEIGHT = 844;

const only = process.argv.slice(2);
const keys = readdirSync(PAGES)
  .filter((f) => f.endsWith('.html'))
  .map((f) => f.slice(0, -5))
  .filter((k) => only.length === 0 || only.includes(k));

// Pages reference images as ximg:<key>; the bundle resolves them at runtime. Resolve
// them here too, or every page reports phantom load failures and renders at the wrong
// height, which then throws off every rect measurement below.
const IMGS = JSON.parse(readFileSync(join(HERE, 'data', 'imgs.json'), 'utf8'));
const resolveImgs = (html) =>
  html.replace(/ximg:([a-zA-Z0-9_]+)/g, (m, k) => IMGS[k] ?? m);

// Ignored console noise: an unresolved ximg would already have been caught by
// build.py, and about:blank has no favicon.
const IGNORE_CONSOLE = /ERR_UNKNOWN_URL_SCHEME|favicon/i;

// Press a control the way the gate needs: scrolled into view and dispatched on the
// element itself. A forced click fires at a centre coordinate that another element
// may own, so the handler never runs and a working control reads as dead.
const press = (async (h) => { await h.evaluate((n) => { n.scrollIntoView({ block: 'center' }); n.click(); }).catch(() => {}); });

const browser = await chromium.launch();

// Signature of everything a click could plausibly change. Evaluated inline rather
// than injected as a global: a control that actually navigates replaces the
// document and wipes any injected helper mid-sweep, which crashed the whole run.
// Hashing the real markup matters too — measuring its LENGTH reports a working
// single-select group as dead, because flipping aria-pressed true->false on one
// control and false->true on another nets to the same character count.
const sig = (page) => page.evaluate(() => {
  // Inner scrollers count too. A carousel's prev/next moves a container's
  // scrollLeft and touches neither the markup nor window.scrollY, so watching only
  // the window reports a working rail as a dead control.
  const scrollers = [...document.querySelectorAll('*')]
    .filter((n) => n.scrollHeight > n.clientHeight || n.scrollWidth > n.clientWidth)
    .map((n) => `${n.scrollTop},${n.scrollLeft}`).join('|');
  const s = document.body.innerHTML + ' ' + window.scrollY + ' ' + scrollers + ' ' +
    [...document.querySelectorAll('input,select,textarea')]
      .map((n) => `${n.value}:${n.checked}`).join(',');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${h}:${s.length}`;
}).catch(() => 'unavailable-' + Math.random());
let failures = 0;
const report = [];

for (const key of keys) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  const consoleErrors = [];
  const note = (t) => !IGNORE_CONSOLE.test(t) && consoleErrors.push(t.slice(0, 160));
  page.on('console', (m) => m.type() === 'error' && note(m.text()));
  page.on('pageerror', (e) => note(`uncaught: ${String(e)}`));

  await page.setContent(resolveImgs(readFileSync(join(PAGES, `${key}.html`), 'utf8')), {
    waitUntil: 'load',
  });
  // Webfonts land after load and change every measurement.
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(350);

  const quirks = await page.evaluate(() => document.compatMode !== 'CSS1Compat');

  const overflow = await page.evaluate((w) => {
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!el.textContent || !el.textContent.trim()) continue;
      if (el.children.length) continue; // leaf text nodes only
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') continue;
      // An element inside its own scroll container is allowed to exceed the frame.
      let p = el.parentElement, scoped = false;
      while (p && p !== document.body) {
        const ps = getComputedStyle(p);
        if (ps.overflowX === 'auto' || ps.overflowX === 'scroll' || ps.overflowX === 'hidden') {
          scoped = true; break;
        }
        p = p.parentElement;
      }
      if (scoped) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > w + 0.5 || r.left < -0.5) {
        bad.push({
          text: el.textContent.trim().slice(0, 44),
          left: Math.round(r.left), right: Math.round(r.right),
          tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 30),
        });
      }
    }
    return bad;
  }, WIDTH);

  const bodyScrolls = await page.evaluate(
    (w) => document.documentElement.scrollWidth > w + 1,
  );

  // Dead-control sweep. Candidates are what the DESIGN says is pressable — a real
  // control element, or anything given cursor:pointer — rather than anything whose
  // class name merely contains "tab" or "chip". Class-name matching flagged table
  // rows and the "Sample" data-label as dead controls, which is noise that gets a
  // gate ignored.
  const mark = () => page.evaluate(() => {
    // Exact signature of everything a click could plausibly change. Hashing the real
    // markup matters: measuring its LENGTH reports a working single-select group as
    // dead, because flipping aria-pressed true->false on one control and false->true
    // on another nets to the same character count.
    const hit = [];
    for (const n of document.querySelectorAll('body *')) {
      const t = n.tagName.toLowerCase();
      // tel:/mailto: hand off to the OS. They work; they just change nothing
      // measurable in-page, so they can never pass a diff test. Skip their
      // descendants too — a span inside one inherits the pointer cursor and
      // would otherwise be reported as a dead control on its own.
      if (n.closest('a[href^="tel:"],a[href^="mailto:"],a[href^="sms:"]')) continue;
      // Form controls are exercised by the form sweep further down, empty and then
      // filled. Clicking a submit button on an empty form correctly does nothing,
      // so testing it here reports a working form as a dead control.
      if (n.closest('form')) continue;
      // A text field is a field, not a control: clicking one correctly changes
      // nothing but focus. Whatever reads it is tested on its own.
      if (t === 'textarea' ||
          (t === 'input' && !/^(checkbox|radio|submit|button|reset|range|file)$/.test(n.type))) {
        continue;
      }
      // A link to another route (href="/listings") is navigation, not in-page state.
      // Clicking one here tears down the document and takes the rest of the sweep
      // with it. Fragment links stay in — they scroll, which is a real change.
      if (n.closest('a[href]:not([href^="#"])')) continue;
      const real = t === 'button' || t === 'select' || t === 'input' ||
        n.getAttribute('role') === 'button' || n.hasAttribute('onclick');
      const frag = t === 'a' && (n.getAttribute('href') || '').length > 1;
      const pointer = getComputedStyle(n).cursor === 'pointer';
      if (real || frag || pointer) hit.push(n);
    }
    // Keep only the outermost of any nested run: a pointer button wrapping a pointer
    // span is one control, and clicking the child would report the parent's handler.
    window.__ctl = hit.filter((n) => !hit.some((o) => o !== n && o.contains(n)));
    window.__ctl.forEach((n, i) => n.setAttribute('data-ctl', String(i)));
    return window.__ctl.length;
  });
  await mark();
  const controls = await page.$$('[data-ctl]');
  const dead = [];
  const suspects = [];
  const seen = new Set();
  for (const el of controls.slice(0, 60)) {
    const id = await el.evaluate((n) => {
      const c = (n.className || '').toString().trim().replace(/\s+/g, '.');
      return `${n.tagName.toLowerCase()}${c ? '.' + c : ''}|${(n.textContent || '').trim().slice(0, 18)}`;
    });
    if (seen.has(id)) continue;
    seen.add(id);
    if (!(await el.isVisible().catch(() => false))) continue;

    const before = await sig(page);
    await press(el);
    // Smooth scrolling runs ~600ms here; sampling sooner reads mid-animation and
    // reports a working scroll control as dead.
    await page.waitForTimeout(650);
    const after = await sig(page);
    if (before === after) suspects.push({ idx: await el.getAttribute('data-ctl'), id });
  }

  // Second pass over the no-ops. A control can do nothing for an honest reason: it
  // is the already-selected member of an exclusive group, it closes a panel that is
  // not open, or it sends a composer that is empty. So before calling one dead,
  // change the page's state — fill the text fields, press a different control — and
  // give it another go. Only a control that does nothing from a state it did not
  // already occupy is actually dead.
  // Identify a suspect by what it IS (tag, classes, label), never by its position in
  // the control list. Some controls are not in the DOM until another one reveals
  // them, so indices shift between loads and an index-based retry clicks the wrong
  // element entirely.
  const findByLabel = async (label) => {
    const i = await page.evaluate((want) => {
      const id = (n) => {
        const c = (n.className || '').toString().trim().replace(/\s+/g, '.');
        return `${n.tagName.toLowerCase()}${c ? '.' + c : ''}|${(n.textContent || '').trim().slice(0, 18)}`;
      };
      const hit = [...document.querySelectorAll('[data-ctl]')].find((n) => id(n) === want);
      return hit ? hit.getAttribute('data-ctl') : null;
    }, label);
    return i === null ? null : page.$(`[data-ctl="${i}"]`);
  };

  const reload = async () => {
    await page.setContent(resolveImgs(readFileSync(join(PAGES, `${key}.html`), 'utf8')),
      { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await mark();
  };

  for (const s of suspects) {
    let alive = false;
    // Judge every suspect from a clean load. The first pass leaves the page wherever
    // its last click put it, and each retry leaves it somewhere else again - a
    // control that works fine on a fresh page reads as dead once an earlier click
    // has already put the page into the state that control produces.
    await reload();
    const others = await page.$$('[data-ctl]');
    for (let i = 0; i < others.length && !alive; i++) {
      const self = await findByLabel(s.id);
      if (self && (await self.isVisible().catch(() => false))) {
        const pre = await sig(page);
        await press(self);
        await page.waitForTimeout(650);
        if ((await sig(page)) !== pre) { alive = true; break; }
      }
      // Change the page's state and try again: the suspect may be the already-selected
      // member of a group, may close a panel that is not open, or may not be in the
      // DOM yet at all.
      await page.evaluate(() => {
        for (const n of document.querySelectorAll('input,textarea')) {
          if (/^(checkbox|radio|submit|button|reset|file)$/.test(n.type)) continue;
          if (n.value) continue;
          n.value = 'Bend';
          n.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await press(others[i]);
      await page.waitForTimeout(650);
      await mark();
    }
    if (!alive) dead.push(s.id);
  }

  // Exercise every form, empty and then filled. A handler that only throws on
  // submit is invisible to the click sweep above — that is exactly how a
  // ReferenceError in a submit path reached this prototype once already.
  const forms = await page.$$('form');
  for (const f of forms) {
    await f.evaluate((el) => {
      const fire = () => el.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      fire(); // empty: should surface validation, not throw
      for (const i of el.querySelectorAll('input')) {
        if (i.type === 'checkbox' || i.type === 'radio') i.checked = true;
        else i.value = i.type === 'email' ? 'someone@example.com'
          : i.type === 'tel' ? '5415550142' : 'Test value';
        i.dispatchEvent(new Event('input', { bubbles: true }));
      }
      fire(); // filled: should reach the success path
    });
    await page.waitForTimeout(120);
  }

  const bad = quirks || bodyScrolls || overflow.length > 0 || dead.length > 0 || consoleErrors.length > 0;
  if (bad) failures++;
  report.push({ key, quirks, bodyScrolls, overflow, dead, consoleErrors, controls: seen.size });
  await page.close();
}

await browser.close();

for (const r of report) {
  const ok = !r.quirks && !r.bodyScrolls && !r.overflow.length && !r.dead.length && !r.consoleErrors.length;
  console.log(`\n${ok ? 'PASS' : 'FAIL'}  ${r.key}   (${r.controls} controls tested)`);
  if (r.quirks) console.log('   quirks mode — missing or malformed doctype');
  if (r.bodyScrolls) console.log('   body scrolls horizontally at 390px');
  for (const o of r.overflow) {
    console.log(`   overflow  ${o.left}..${o.right}  <${o.tag} class="${o.cls}">  "${o.text}"`);
  }
  for (const d of r.dead) console.log(`   dead control  ${d}`);
  for (const e of r.consoleErrors) console.log(`   console  ${e}`);
}

console.log(`\n${report.length - failures}/${report.length} pages clean`);
process.exit(failures ? 1 : 0);

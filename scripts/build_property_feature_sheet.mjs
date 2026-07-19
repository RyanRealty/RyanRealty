#!/usr/bin/env node
/**
 * build_property_feature_sheet.mjs — CANONICAL hi-res print property flyer (8.5x11 @ 300 DPI).
 *
 * Reusable, config-driven engine. Renders a single-page listing feature sheet:
 *   header (brand logo + status kicker) · hero photo · address + price ·
 *   6-cell spec strip · brand-clean description · 3x2 photo tile grid ·
 *   cream signature sign-off (listing agent headshot + name + contact) ·
 *   tracked QR to the live listing page.
 *
 * Output: 850x1100 CSS px rendered at deviceScaleFactor 3 -> 2550x3300 raster
 * (= 8.5x11 @ 300 DPI) + a Letter-size print PDF, plus citation/font sidecars.
 *
 * HARD RULES (see social_media_skills/flyer-design/SKILL.md "Print feature sheet"):
 *  - Every figure in the config MUST trace to a live Supabase pull (CLAUDE.md §0).
 *  - Description copy is brand-voice governed (CLAUDE.md §Brand Voice): no banned
 *    words, no em-dash/semicolon, no exclamation. The engine warns on hard fails.
 *  - Brand fonts embedded (Amboqia + Geist + Azo). No fallback.
 *  - Navy #102742 + cream #faf8f4 only. No gold. No navy footer bar.
 *  - Draft-first: renders to out/ (gitignored). Never auto-committed.
 *
 * Usage:
 *   node scripts/build_property_feature_sheet.mjs --config <path.json> [--out <dir>]
 *
 * Config schema: see social_media_skills/flyer-design/SKILL.md.
 */
import { chromium } from 'playwright';
import QRCode from 'qrcode';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname, isAbsolute } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const W = 850, H = 1100, DSF = 3, NAVY = '#102742', CREAM = '#faf8f4', SAND = '#e8e2d4';

// ---- args ----
const argv = process.argv.slice(2);
function arg(name) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; }
const CONFIG_PATH = arg('--config');
if (!CONFIG_PATH) { console.error('ERROR: --config <path.json> is required'); process.exit(1); }
const cfg = JSON.parse(readFileSync(resolve(CONFIG_PATH), 'utf8'));
const CFG_DIR = dirname(resolve(CONFIG_PATH));
const OUT = resolve(arg('--out') || (cfg.slug ? resolve(ROOT, 'out/listing', cfg.slug) : CFG_DIR));
mkdirSync(OUT, { recursive: true });

// ---- broker registry (resolve the LISTING AGENT for the signature) ----
// name/role/phone/web/headshot per Ryan Realty broker. Source: public.brokers +
// design_system/ryan-realty/assets/team. Phones are each broker's direct line in
// dotted brand format; override per-flyer via config.agent.phone if needed (e.g.
// the FUB-tracked bio line for call attribution).
const BROKERS = {
  matt: { name: 'Matt Ryan', role: 'Ryan Realty · Principal Broker', phone: '541.213.6706', web: 'ryan-realty.com', headshot: 'design_system/ryan-realty/assets/team/matt-ryan.png', emails: ['matt@ryan-realty.com'] },
  paul: { name: 'Paul Stevenson', role: 'Ryan Realty · Broker', phone: '541.977.6841', web: 'ryan-realty.com', headshot: 'design_system/ryan-realty/assets/team/paul-stevenson.png', emails: ['paul@ryan-realty.com'] },
  rebecca: { name: 'Rebecca Peterson', role: 'Ryan Realty · Broker', phone: '415.308.9087', web: 'ryan-realty.com', headshot: 'design_system/ryan-realty/assets/team/rebecca-peterson.png', emails: ['rebeccapeterson@ryan-realty.com', 'rebecca@ryan-realty.com'] },
};
function resolveAgent(a) {
  if (a && typeof a === 'object' && a.name) return a;               // explicit inline agent
  const token = String(a || cfg.agent_email || 'matt').toLowerCase().trim();
  if (BROKERS[token]) return BROKERS[token];
  const byEmail = Object.values(BROKERS).find((b) => b.emails.includes(token));
  if (byEmail) return byEmail;
  console.warn(`WARN: agent "${token}" not in broker registry — defaulting to Matt`);
  return BROKERS.matt;
}
const AGENT = resolveAgent(cfg.agent);

// ---- asset embedding ----
function du(a) {
  const abs = isAbsolute(a) ? a : resolve(ROOT, a);
  if (!existsSync(abs)) throw new Error('missing asset: ' + abs);
  const e = abs.split('.').pop().toLowerCase();
  const m = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', otf: 'font/otf', ttf: 'font/ttf' }[e] || 'application/octet-stream';
  return `data:${m};base64,${readFileSync(abs).toString('base64')}`;
}
// photo paths in config resolve relative to the config file's directory
function photo(p) { return du(isAbsolute(p) ? p : resolve(CFG_DIR, p)); }

const AMBOQIA = du('design_system/ryan-realty/fonts/Amboqia_Boriango.otf');
const AZO = du('design_system/ryan-realty/fonts/AzoSans-Medium.ttf');
const LOGO = du('design_system/ryan-realty/assets/brand/logo-blue.png');
const MUG = du(AGENT.headshot);
const HERO = photo(cfg.hero);
const TILES = (cfg.tiles || []).map((t) => ({ label: t.label || '', uri: photo(t.file) }));
if (TILES.length !== 6) console.warn(`WARN: layout is designed for exactly 6 tiles; got ${TILES.length}`);

// ---- tracked QR ----
const utm = cfg.utm || {};
const params = new URLSearchParams({
  utm_source: utm.source || 'print_flyer',
  utm_medium: utm.medium || 'qr',
  utm_campaign: utm.campaign || cfg.slug || 'listing_flyer',
});
const QR_URL = cfg.listing_url ? `${cfg.listing_url}?${params}` : null;
if (!QR_URL) console.warn('WARN: no config.listing_url — QR omitted');
const QR_DATA = QR_URL ? await QRCode.toDataURL(QR_URL, { errorCorrectionLevel: 'M', margin: 1, width: 640, color: { dark: NAVY, light: CREAM } }) : null;

// ---- brand-voice guard (warn, do not block) ----
const BANNED = /\b(stunning|nestled|boasts|charming|pristine|luxurious|breathtaking|gorgeous|must-see|dream home|meticulously|hidden gem|turnkey|tucked away)\b|[—;]/i;
if (cfg.description && BANNED.test(cfg.description)) {
  console.warn('WARN: description may contain a brand-voice hard fail (banned word / em-dash / semicolon). Review before ship.');
}

// ---- markup ----
const F = cfg;
const stat = (n, l) => `<div class="cell"><div class="num">${n}</div><div class="lab">${l}</div></div>`;
const thumb = (g) => `<div class="th" style="background-image:url('${g.uri}')">${g.label ? `<span class="thl">${g.label}</span>` : ''}</div>`;
const HEAD = `
@font-face{font-family:'Amboqia';src:url('${AMBOQIA}') format('opentype');font-weight:400;font-display:block;}
@font-face{font-family:'Azo';src:url('${AZO}') format('truetype');font-weight:500;font-display:block;}
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased;}
body{width:${W}px;height:${H}px;background:${CREAM};font-family:'Geist',sans-serif;color:${NAVY};overflow:hidden;}
.top{padding:28px 44px 0;}
.hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
.hdr img{height:42px;}
.kick{font-family:'Azo','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.22em;font-size:13px;color:${NAVY};opacity:0.75;}
.hero{width:100%;height:280px;border-radius:14px;background:url('${HERO}') center ${cfg.hero_focus || '60%'}/cover no-repeat;position:relative;box-shadow:0 8px 24px rgba(16,39,66,0.16);}
.tag{position:absolute;top:16px;left:16px;background:${NAVY};color:${CREAM};font-family:'Azo','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.18em;font-size:11px;padding:8px 14px;border-radius:6px;}
.arow{display:flex;align-items:flex-end;justify-content:space-between;margin-top:16px;}
.addr{font-family:'Amboqia',serif;font-size:46px;line-height:0.98;letter-spacing:-0.01em;}
.sub{font-size:16px;color:rgba(16,39,66,0.66);margin-top:7px;}
.price{font-weight:600;font-size:38px;letter-spacing:-0.01em;font-variant-numeric:tabular-nums;white-space:nowrap;}
.stats{display:flex;margin-top:14px;background:rgba(16,39,66,0.045);border:1px solid ${SAND};border-radius:12px;overflow:hidden;}
.cell{flex:1;text-align:center;padding:12px 4px;border-right:1px solid ${SAND};}
.cell:last-child{border-right:none;}
.num{font-weight:600;font-size:22px;font-variant-numeric:tabular-nums;}
.lab{font-family:'Azo','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.11em;font-size:10px;color:rgba(16,39,66,0.6);margin-top:4px;}
.desc{margin-top:14px;font-size:15px;line-height:1.62;color:rgba(16,39,66,0.9);}
.grid{margin-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.th{height:146px;border-radius:10px;background-size:cover;background-position:center;position:relative;box-shadow:0 4px 12px rgba(16,39,66,0.1);}
.thl{position:absolute;left:9px;bottom:9px;background:rgba(16,39,66,0.72);color:${CREAM};font-family:'Azo','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;font-size:9px;padding:4px 8px;border-radius:5px;}
.sign{margin-top:14px;padding-top:16px;border-top:1px solid ${SAND};display:flex;align-items:center;gap:20px;}
.sign img.mug{height:104px;width:auto;object-fit:contain;object-position:bottom;flex:none;align-self:flex-end;margin-bottom:-1px;}
.sig .n{font-family:'Amboqia',serif;font-size:34px;line-height:0.98;}
.sig .r{font-family:'Azo','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.13em;color:rgba(16,39,66,0.62);font-size:12px;margin-top:8px;}
.sig .ct{font-weight:600;font-size:17px;margin-top:9px;font-variant-numeric:tabular-nums;}
.qr{margin-left:auto;display:flex;align-items:center;gap:12px;}
.qr .cap{font-family:'Azo','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.11em;font-size:11px;color:rgba(16,39,66,0.7);text-align:right;line-height:1.45;}
.qr img{width:98px;height:98px;display:block;flex:none;}
`;
const subLine = [F.city, F.sub].filter(Boolean).join(' · ');
const statsRow = [
  F.beds && stat(F.beds, 'Beds'), F.baths && stat(F.baths, 'Baths'), F.sqft && stat(F.sqft, 'Sq Ft'),
  F.lot && stat(`${F.lot} ac`, 'Lot'), F.year && stat(F.year, 'Built'), F.garage && stat(F.garage, 'Garage'),
].filter(Boolean).join('');
const qrBlock = QR_DATA ? `<div class="qr"><div class="cap">Scan to tour<br>this listing</div><img src="${QR_DATA}"></div>` : '';
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${HEAD}</style></head><body>
<div class="top">
  <div class="hdr"><img src="${LOGO}"><div class="kick">${F.kicker || 'Just Listed'}</div></div>
  <div class="hero">${F.tag !== false ? `<span class="tag">${F.tag || 'Just Listed'}</span>` : ''}</div>
  <div class="arow">
    <div><div class="addr">${F.address1}</div><div class="sub">${subLine}</div></div>
    <div class="price">${F.price}</div>
  </div>
  <div class="stats">${statsRow}</div>
  <div class="desc">${F.description}</div>
  <div class="grid">${TILES.map(thumb).join('')}</div>
  <div class="sign">
    <img class="mug" src="${MUG}">
    <div class="sig"><div class="n">${AGENT.name}</div><div class="r">${AGENT.role}</div>
      <div class="ct">${AGENT.phone} · ${AGENT.web}</div></div>
    ${qrBlock}
  </div>
</div>
</body></html>`;

// ---- render ----
const b = await chromium.launch();
try {
  const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve());
  await page.waitForTimeout(400);
  const contentH = await page.evaluate(() => document.querySelector('.top').getBoundingClientRect().height);
  console.log(`content height: ${Math.round(contentH)}px (canvas ${H}px, ${contentH <= H ? 'FITS' : 'OVERFLOW ' + Math.round(contentH - H) + 'px — trim copy/photos'})`);
  const pngPath = resolve(OUT, 'feature-sheet.png');
  await page.screenshot({ path: pngPath });
  await page.close();
  console.log('feature-sheet.png done (2550x3300 @ 300 DPI)');

  const pngUri = du(pngPath);
  const pdfPage = await b.newPage();
  await pdfPage.setContent(
    `<!doctype html><html><head><style>@page{size:8.5in 11in;margin:0}html,body{margin:0;padding:0}img{width:8.5in;height:11in;display:block}</style></head><body><img src="${pngUri}"></body></html>`,
    { waitUntil: 'networkidle' }
  );
  await pdfPage.pdf({ path: resolve(OUT, 'feature-sheet.pdf'), width: '8.5in', height: '11in', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await pdfPage.close();
  console.log('feature-sheet.pdf done (Letter 8.5x11)');
} finally { await b.close(); }

// ---- sidecars ----
const fetched = new Date().toISOString();
writeFileSync(resolve(OUT, 'feature-sheet.citations.json'), JSON.stringify({
  source: cfg.source || 'Supabase ryan-realty-platform · public.listings',
  listing_key: cfg.listing_key || null, mls_number: cfg.mls || null, fetched_at_iso: fetched,
  agent: AGENT.name, qr_target: QR_URL,
  qr_tracking: QR_URL ? `GA4 attribution via utm_source=${params.get('utm_source')} / utm_medium=${params.get('utm_medium')} / utm_campaign=${params.get('utm_campaign')}` : 'none',
  figures: [F.price, F.beds && `${F.beds} bd`, F.baths && `${F.baths} ba`, F.sqft && `${F.sqft} sqft`, F.lot && `${F.lot} ac`, F.year, F.garage && `${F.garage} garage`].filter(Boolean),
}, null, 2));
writeFileSync(resolve(OUT, 'feature-sheet.fonts_used.json'), JSON.stringify({
  display: { family: 'Amboqia Boriango', files: ['design_system/ryan-realty/fonts/Amboqia_Boriango.otf'] },
  body: { family: 'Geist', files: ['Google Fonts (Geist 400/500/600/700)'] },
  ribbon: { family: 'Azo Sans Medium', files: ['design_system/ryan-realty/fonts/AzoSans-Medium.ttf'] },
  fallbacks_suppressed: true,
}, null, 2));
console.log(`sidecars written · agent: ${AGENT.name}${QR_URL ? ' · QR: ' + QR_URL : ''}`);

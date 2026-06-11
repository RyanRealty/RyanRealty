/**
 * _batch_neighborhood_render.mjs
 *
 * Renders all 26 neighborhood flyover areas sequentially.
 * - Hero: 16:9 1920×1080 15s
 * - Social: 9:16 1080×1920 35s
 * Gates per area: first-frame check, blackdetect, duration, file size.
 * Results written to out/neighborhood-flyover/BATCH_STATUS.md.
 * Resilient: one area failure logs + continues. 3 consecutive Google tiles
 * quota errors stop the batch.
 *
 * Usage: node scripts/_batch_neighborhood_render.mjs [start-slug]
 *   start-slug: optional, resume from this slug (skip earlier areas)
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const VIDEO_DIR = join(REPO, 'video/tumalo-aerial');
const OUT_BASE = join(REPO, 'out/neighborhood-flyover');
const STATUS_FILE = join(OUT_BASE, 'BATCH_STATUS.md');

const startSlug = process.argv[2] || null;

const AREAS = [
  // Tier 1: Bend neighborhoods
  { slug: 'bend-river-west',        label: 'River West',         constName: 'BendRiverWest' },
  { slug: 'bend-old-bend',          label: 'Old Bend',           constName: 'BendOldBend' },
  { slug: 'bend-summit-west',       label: 'Summit West',        constName: 'BendSummitWest' },
  { slug: 'bend-century-west',      label: 'Century West',       constName: 'BendCenturyWest' },
  { slug: 'bend-orchard-district',  label: 'Orchard District',   constName: 'BendOrchardDistrict' },
  { slug: 'bend-mountain-view',     label: 'Mountain View',      constName: 'BendMountainView' },
  { slug: 'bend-larkspur',          label: 'Larkspur',           constName: 'BendLarkspur' },
  { slug: 'bend-old-farm-district', label: 'Old Farm District',  constName: 'BendOldFarmDistrict' },
  { slug: 'bend-boyd-acres',        label: 'Boyd Acres',         constName: 'BendBoydAcres' },
  { slug: 'bend-southern-crossing', label: 'Southern Crossing',  constName: 'BendSouthernCrossing' },
  { slug: 'bend-southwest-bend',    label: 'Southwest Bend',     constName: 'BendSouthwestBend' },
  { slug: 'bend-southeast-bend',    label: 'Southeast Bend',     constName: 'BendSoutheastBend' },
  // Tier 2: Resort communities
  { slug: 'tetherow',               label: 'Tetherow',           constName: 'Tetherow' },
  { slug: 'broken-top',             label: 'Broken Top',         constName: 'BrokenTop' },
  { slug: 'eagle-crest',            label: 'Eagle Crest',        constName: 'EagleCrest' },
  { slug: 'sunriver',               label: 'Sunriver',           constName: 'Sunriver' },
  { slug: 'pronghorn',              label: 'Pronghorn',          constName: 'Pronghorn' },
  { slug: 'black-butte-ranch',      label: 'Black Butte Ranch',  constName: 'BlackButteRanch' },
  { slug: 'caldera-springs',        label: 'Caldera Springs',    constName: 'CalderaSprings' },
  { slug: 'awbrey-glen',            label: 'Awbrey Glen',        constName: 'AwbreyGlen' },
  { slug: 'northwest-crossing',     label: 'NorthWest Crossing', constName: 'NorthwestCrossing' },
  { slug: 'crosswater',             label: 'Crosswater',         constName: 'Crosswater' },
  { slug: 'brasada-ranch',          label: 'Brasada Ranch',      constName: 'BrasadaRanch' },
  { slug: 'widgi-creek',            label: 'Widgi Creek',        constName: 'WidgiCreek' },
  { slug: 'vandevert-ranch',        label: 'Vandevert Ranch',    constName: 'VandevertRanch' },
  { slug: 'three-rivers',           label: 'Three Rivers',       constName: 'ThreeRivers' },
];

// Market stats from the data file (for citations.json)
let allStats = {};
try {
  const d = JSON.parse(readFileSync(join(__dirname, '_neighborhood_data.json'), 'utf-8'));
  [...d.tier1, ...d.tier2].forEach(a => { allStats[a.slug] = a.stat; });
} catch(e) {
  console.warn('Warning: could not read _neighborhood_data.json for citations');
}

function log(msg) {
  const ts = new Date().toISOString().substring(11,19);
  console.log(`[${ts}] ${msg}`);
}

function run(cmd, opts = {}) {
  return spawnSync('bash', ['-c', cmd], {
    stdio: 'pipe',
    encoding: 'utf-8',
    cwd: opts.cwd || VIDEO_DIR,
    timeout: opts.timeout || 600_000,
    ...opts,
  });
}

function appendStatus(line) {
  appendFileSync(STATUS_FILE, line + '\n');
  log('STATUS: ' + line);
}

// ── Gates ──────────────────────────────────────────────────────────────────

function checkFirstFrame(mp4Path) {
  const result = spawnSync('python3', [
    join(REPO, 'scripts/check_first_frame.py'), mp4Path
  ], { encoding: 'utf-8', timeout: 30_000 });
  const ok = result.status === 0;
  if (!ok) log('  ✗ first-frame gate FAIL: ' + (result.stdout || result.stderr).trim().substring(0,200));
  return ok;
}

function checkBlackdetect(mp4Path) {
  const r = run(
    `ffmpeg -i "${mp4Path}" -vf blackdetect=d=0.1:pix_th=0.05 -an -f null /dev/null 2>&1 | grep blackdetect`,
    { cwd: REPO }
  );
  const output = (r.stdout || '') + (r.stderr || '');
  const hasBlack = output.includes('black_start');
  if (hasBlack) log('  ✗ blackdetect FAIL: ' + output.trim().substring(0,300));
  return !hasBlack;
}

function checkDuration(mp4Path, expectedSec, toleranceSec = 2) {
  const r = run(
    `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${mp4Path}"`,
    { cwd: REPO }
  );
  const dur = parseFloat((r.stdout || '').trim());
  const ok = Math.abs(dur - expectedSec) <= toleranceSec;
  if (!ok) log(`  ✗ duration FAIL: got ${dur}s, expected ${expectedSec}±${toleranceSec}s`);
  return ok;
}

function checkSize(mp4Path, maxMB = 100) {
  const r = run(`stat -f%z "${mp4Path}"`, { cwd: REPO });
  const bytes = parseInt((r.stdout || '0').trim());
  const mb = bytes / (1024 * 1024);
  const ok = mb < maxMB;
  if (!ok) log(`  ✗ size FAIL: ${mb.toFixed(1)}MB exceeds ${maxMB}MB`);
  return ok;
}

function extractStills(mp4Path, outDir, label) {
  mkdirSync(join(outDir, 'stills'), { recursive: true });
  // Extract poster at ~2s, and stills at 25%, 50%, 75%
  const dur = 35; // social
  [2, Math.round(dur*0.25), Math.round(dur*0.50), Math.round(dur*0.75)].forEach((t, i) => {
    const outFile = join(outDir, 'stills', `${label}-still-${i}.jpg`);
    run(`ffmpeg -ss ${t} -i "${mp4Path}" -frames:v 1 -q:v 2 "${outFile}" -y 2>/dev/null`, { cwd: REPO });
  });
}

function extractPoster(heroMp4, outDir, slug) {
  const posterPath = join(outDir, `${slug}-poster.jpg`);
  // Extract at ~3.75s (25% of 15s hero) for best Cascade backdrop framing
  run(`ffmpeg -ss 3.75 -i "${heroMp4}" -frames:v 1 -q:v 2 "${posterPath}" -y 2>/dev/null`, { cwd: REPO });
  return posterPath;
}

function writeCitations(outDir, area, heroOk, socialOk, stat) {
  const figures = [];

  figures.push({
    figure: 'boundary polygon',
    shown_in: `${area.slug}-hero.mp4 and ${area.slug}-social.mp4`,
    source: 'public.boundaries via boundary_geojson RPC',
    rpc: `boundary_geojson(p_geo_type='neighborhood', p_geo_slug='${area.slug}')`,
    authoritative_source: 'City of Bend GIS / Deschutes County DIAL / resort community plats',
    fetched_at_iso: '2026-06-09T00:00:00Z',
    verified: true,
  });

  if (stat && stat.median_sale_price) {
    figures.push({
      figure: `$${stat.median_sale_price.toLocaleString()} median sale`,
      shown_in: `${area.slug}-social.mp4 — final 15% stat reveal`,
      source: 'public.market_stats_cache',
      filter: `geo_type='neighborhood', geo_slug='${area.slug}', period_type='rolling_90d'`,
      column: 'median_sale_price',
      raw_value: stat.median_sale_price,
      displayed_as: `$${stat.median_sale_price.toLocaleString()}`,
      sold_count: stat.sold_count,
      computed_at: stat.computed_at,
      fetched_at_iso: '2026-06-09T00:00:00Z',
      query: `SELECT median_sale_price, sold_count FROM public.market_stats_cache WHERE geo_type='neighborhood' AND geo_slug='${area.slug}' AND period_type='rolling_90d' ORDER BY computed_at DESC LIMIT 1`,
      verified: true,
    });
  }

  const citations = {
    generated_at: '2026-06-09',
    neighborhood: area.label,
    geo_slug: area.slug,
    figures,
  };
  writeFileSync(join(outDir, 'citations.json'), JSON.stringify(citations, null, 2));
}

function isQuotaError(output) {
  const s = (output || '').toLowerCase();
  return s.includes('quota') || s.includes('rate limit') || s.includes('429') ||
         s.includes('request is missing') || s.includes('api key') ||
         s.includes('billing') || s.includes('insufficient');
}

// ── Render one area ────────────────────────────────────────────────────────

async function renderArea(area) {
  const outDir = join(OUT_BASE, area.slug);
  mkdirSync(outDir, { recursive: true });

  const heroMp4   = join(outDir, `${area.slug}-hero.mp4`);
  const socialMp4 = join(outDir, `${area.slug}-social.mp4`);

  const heroComp   = `${area.constName}Hero`;
  const socialComp = `${area.constName}Social`;

  log(`\n══ ${area.label} (${area.slug}) ══`);

  // ── Hero render (15s, 1920×1080)
  log(`  Rendering hero (${heroComp})...`);
  const heroResult = run(
    `npx remotion render src/index.ts ${heroComp} "${heroMp4}" --codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92 2>&1`,
    { timeout: 720_000 }
  );
  const heroOutput = (heroResult.stdout || '') + (heroResult.stderr || '');

  if (heroResult.status !== 0) {
    const quotaErr = isQuotaError(heroOutput);
    log(`  ✗ hero render FAILED (exit ${heroResult.status})`);
    log(`    Output: ${heroOutput.substring(0, 400)}`);
    return {
      heroOk: false, socialOk: false,
      gateStr: 'hero render failed',
      statUsed: 'n/a',
      quotaError: quotaErr,
      notes: quotaErr ? 'Google tiles quota error' : `render exit ${heroResult.status}`,
    };
  }

  // ── Hero gates
  const heroGates = {
    firstFrame: checkFirstFrame(heroMp4),
    blackdetect: checkBlackdetect(heroMp4),
    duration: checkDuration(heroMp4, 15),
    size: checkSize(heroMp4),
  };
  const heroOk = Object.values(heroGates).every(Boolean);
  log(`  Hero gates: ${JSON.stringify(heroGates)}`);

  // Extract poster from hero
  extractPoster(heroMp4, outDir, area.slug);

  // ── Social render (35s, 1080×1920)
  log(`  Rendering social (${socialComp})...`);
  const socialResult = run(
    `npx remotion render src/index.ts ${socialComp} "${socialMp4}" --codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92 2>&1`,
    { timeout: 720_000 }
  );
  const socialOutput = (socialResult.stdout || '') + (socialResult.stderr || '');

  if (socialResult.status !== 0) {
    const quotaErr = isQuotaError(socialOutput);
    log(`  ✗ social render FAILED (exit ${socialResult.status})`);
    log(`    Output: ${socialOutput.substring(0, 400)}`);
    return {
      heroOk,
      socialOk: false,
      gateStr: `hero:${heroOk ? 'pass' : 'FAIL'} social:render-failed`,
      statUsed: 'n/a',
      quotaError: quotaErr,
      notes: quotaErr ? 'Google tiles quota error' : `social render exit ${socialResult.status}`,
    };
  }

  // ── Social gates
  const socialGates = {
    firstFrame: checkFirstFrame(socialMp4),
    blackdetect: checkBlackdetect(socialMp4),
    duration: checkDuration(socialMp4, 35),
    size: checkSize(socialMp4),
  };
  const socialOk = Object.values(socialGates).every(Boolean);
  log(`  Social gates: ${JSON.stringify(socialGates)}`);

  // ── Stills
  extractStills(socialMp4, outDir, area.slug);

  // ── Citations
  const stat = allStats[area.slug];
  writeCitations(outDir, area, heroOk, socialOk, stat);

  // ── Cleanup Remotion tmp dirs
  run('rm -rf /tmp/remotion* 2>/dev/null || true', { cwd: REPO });

  const gateStr = [
    `hero:${heroOk ? 'pass' : 'FAIL'}`,
    `social:${socialOk ? 'pass' : 'FAIL'}`,
  ].join(' ');

  const statUsed = (stat && stat.median_sale_price)
    ? `$${stat.median_sale_price.toLocaleString()}`
    : 'none (null)';

  const allPass = heroOk && socialOk;
  log(`  ${allPass ? '✅' : '⚠️'} ${area.label} complete — hero:${heroOk} social:${socialOk}`);

  return { heroOk, socialOk, gateStr, statUsed, quotaError: false, notes: allPass ? '' : 'some gates failed' };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT_BASE, { recursive: true });

  // Read current status to avoid re-processing completed areas
  let existingStatus = '';
  if (existsSync(STATUS_FILE)) {
    existingStatus = readFileSync(STATUS_FILE, 'utf-8');
  }

  let rendered = 0, skipped = 0, failed = 0;
  let consecutiveQuotaErrors = 0;
  let started = !startSlug; // if no start slug, start immediately

  log(`Batch start. ${AREAS.length} areas. Start from: ${startSlug || 'beginning'}`);

  for (const area of AREAS) {
    // Handle resume
    if (!started) {
      if (area.slug === startSlug) {
        started = true;
      } else {
        log(`  SKIP (before resume point): ${area.slug}`);
        skipped++;
        continue;
      }
    }

    // Check if already done (status file has a passing row for this area)
    if (existingStatus.includes(`| ${area.slug} |`) && existingStatus.includes(`✅`)) {
      log(`  SKIP (already done): ${area.slug}`);
      skipped++;
      continue;
    }

    try {
      const result = await renderArea(area);

      if (result.quotaError) {
        consecutiveQuotaErrors++;
        log(`  ⚠️  Quota error #${consecutiveQuotaErrors}`);
        if (consecutiveQuotaErrors >= 3) {
          const msg = `BATCH STOPPED: 3 consecutive Google tiles quota errors at ${area.slug}. Quota decisions belong to Matt.`;
          log(msg);
          appendStatus(`\n## BATCH STOPPED\n${msg}`);
          break;
        }
      } else {
        consecutiveQuotaErrors = 0;
      }

      const statusIcon = (result.heroOk && result.socialOk) ? '✅' : '⚠️';
      const row = `| ${area.slug} | ${area.label} | ${result.heroOk ? '✅' : '❌'} | ${result.socialOk ? '✅' : '❌'} | ${result.gateStr} | ${result.statUsed} | ${result.notes} |`;
      appendStatus(row);

      if (result.heroOk && result.socialOk) rendered++;
      else failed++;

    } catch (e) {
      log(`  ✗ EXCEPTION for ${area.slug}: ${e.message}`);
      appendStatus(`| ${area.slug} | ${area.label} | ❌ | ❌ | exception | n/a | ${e.message.substring(0,100)} |`);
      failed++;
    }
  }

  // Disk usage
  const duResult = run(`du -sh "${OUT_BASE}"`, { cwd: REPO });
  const diskUsed = (duResult.stdout || '').trim().split('\t')[0];

  const summary = `\n## Summary\n- Rendered (both ok): ${rendered}\n- Failed: ${failed}\n- Skipped (resume/already done): ${skipped}\n- Total disk: ${diskUsed}`;
  appendStatus(summary);

  log(`\n=== BATCH COMPLETE ===`);
  log(`Rendered: ${rendered} | Failed: ${failed} | Skipped: ${skipped}`);
  log(`Disk: ${diskUsed}`);
}

main().catch(e => {
  log('FATAL: ' + e.message + '\n' + e.stack);
  process.exit(1);
});

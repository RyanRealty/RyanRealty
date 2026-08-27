#!/usr/bin/env node
/**
 * check-dead-ui.mjs — gate 9: curated list of deprecated/orphaned UI files.
 *
 * WHY (from site-consistency-audit-2026-06-09.md P2.7 + P1.25):
 *   Dead components with the old non-design-system patterns linger with zero
 *   importers. The default-export aliases look legitimate, inviting re-adoption.
 *   A future dev importing `Breadcrumb from '@/components/Breadcrumb'` reintroduces
 *   a second breadcrumb impl with divergent styling. components/site/BreadcrumbNav
 *   is the sole correct breadcrumb.
 *
 * This gate FAILS if any path in the curated DEAD_FILES list exists on disk.
 *
 * DESIGN PHILOSOPHY — curated list (not a zero-importer scanner):
 *   A generic "find all zero-importer components" scanner is prone to false
 *   positives (lazy-loaded components, components used only in E2E tests,
 *   re-exported barrels, etc.) and requires complex import-graph walking.
 *   This gate is a curated list of specifically confirmed dead files — each was
 *   verified to have zero import statements across app/, components/, and lib/
 *   before being added. When a new dead file is confirmed (via grep + tsc),
 *   add it to DEAD_FILES with a brief comment explaining why it is dead.
 *
 * HOW TO ADD A NEW ENTRY:
 *   1. Confirm zero import statements:
 *      grep -r "from.*['\"].*YourComponent['\"]" app/ components/ lib/ --include="*.ts" --include="*.tsx"
 *   2. Confirm no type-only imports:
 *      grep -r "YourComponent" app/ components/ lib/ --include="*.ts" --include="*.tsx" | grep import
 *   3. Delete the file: rm path/to/YourComponent.tsx (NOT git rm)
 *   4. Run: npx tsc --noEmit  (must be clean or show only pre-existing errors)
 *   5. Add the path to DEAD_FILES below with a comment.
 *
 * The path format is relative to the repo root, using forward slashes.
 *
 * Usage: node scripts/check-dead-ui.mjs [--json]
 */

import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const JSON_OUT = process.argv.includes('--json')

// ---------------------------------------------------------------------------
// Curated dead-file list
// Each entry is relative to the repo root.
// Format: { path: string, reason: string }
// ---------------------------------------------------------------------------

const DEAD_FILES = [
  // ----- The KB homepage register (deleted 2026-08-27 with its last consumer) -----
  // The v3 Broadside homepage rebuild (Matt approved 2026-08-27) removed
  // app/page.tsx's kb imports; these nine components then had zero importers
  // (verified via grep + ci:reachable-exports) and were deleted per the orphan
  // cascade. Their jobs live on the barrel: the hero is V3Stage, towns and
  // communities are V3Ledger rows, featured homes are the V3Field, the market
  // HUD is the V3Instrument. Do not recreate them. The pattern set is OPEN, but a section that needs a new pattern BUILDS a barrel primitive in components/site/v3 rather than reviving one of these.
  { path: 'components/site/kb/KbHero.client.tsx', reason: 'hero → V3Stage in app/page.tsx' },
  { path: 'components/site/kb/KbExploreTowns.client.tsx', reason: 'towns → V3Ledger #towns' },
  { path: 'components/site/kb/KbCommunities.client.tsx', reason: 'communities → V3Ledger #communities' },
  { path: 'components/site/kb/KbTicker.client.tsx', reason: 'tape rows → the Field list' },
  { path: 'components/site/kb/KbSell.client.tsx', reason: 'seller ask → the market Instrument ghost action' },
  { path: 'components/site/kb/KbTestimonials.client.tsx', reason: 'proof lives at /reviews' },
  { path: 'components/site/kb/KbTeam.client.tsx', reason: 'brokers live at /team' },
  { path: 'components/site/kb/KbMarketHud.client.tsx', reason: 'market HUD → V3Instrument #market' },
  { path: 'components/site/kb/KbCommunityAlerts.client.tsx', reason: 'alert capture lives on place-page sheets' },
  { path: 'lib/market/publish-median-caption.ts', reason: 'no sell surface publishes a median; ci:publish-median-caption asserts that per surface' },
  { path: 'app/cities/[slug]/PublicPaceStats.tsx', reason: 'pace figures fold into leftoverMarketFigures via publicPaceItems' },
  { path: 'app/cities/[slug]/PublicMixStats.tsx', reason: 'mix figures fold into leftoverMarketFigures via buildPublicMixFigures' },
  // ----- Deprecated breadcrumb impls -----
  // The sole breadcrumb is components/site/BreadcrumbNav.tsx. The following
  // are old implementations that have been superseded. They have zero import
  // statements but their names look legitimate, risking re-adoption.
  {
    path: 'components/Breadcrumb.tsx',
    reason:
      'Deprecated alias of BreadcrumbNav — imports @/components/ui/breadcrumb and aliases ' +
      'it as BreadcrumbNav (confusingly). Zero importers confirmed. Sole breadcrumb: ' +
      'components/site/BreadcrumbNav.tsx.',
  },
  {
    path: 'components/layout/BreadcrumbStrip.tsx',
    reason:
      'Deprecated BreadcrumbStrip — legacy layout breadcrumb superseded by ' +
      'components/site/BreadcrumbNav.tsx. Zero importers confirmed.',
  },

  // ----- Orphaned listing-detail components -----
  // The live listing-detail page (app/listing/[listingKey]/page.tsx) uses
  // components/site/listing-detail/* exclusively. The following were the
  // old implementation and have zero importers.
  {
    path: 'components/site/listing-detail/PhotoGallery.tsx',
    reason:
      'Superseded by components/site/listing-detail/PhotoGalleryLightbox.tsx (used by ListingHero). ' +
      'Zero importers confirmed — no import statement references this path. ' +
      'Same hand-rolled overlay pattern identified in P1.25.',
  },
  {
    path: 'components/listing/ListingHeader.tsx',
    reason:
      'Orphaned listing component — the live listing-detail page uses ' +
      'components/site/listing-detail/* exclusively. Zero importers confirmed ' +
      '(2026-06-09 sweep). Already used the H1 primitive correctly; deleted ' +
      'to prevent inadvertent re-adoption of a superseded component.',
  },
  {
    path: 'components/listing/PropertyDetails.tsx',
    reason:
      'Orphaned listing component — same class as ListingHeader.tsx. Zero importers ' +
      'confirmed (2026-06-09 sweep). Already used the H2 primitive correctly; deleted ' +
      'to prevent inadvertent re-adoption of a superseded component.',
  },
  {
    path: 'components/listing/ListingSummary.tsx',
    reason:
      'Orphaned listing component — the live listing-detail page uses ' +
      'components/site/listing-detail/* exclusively. Zero importers confirmed. ' +
      'Contains .toLocaleString() render-body date formatting (hydration risk, P2.3).',
  },
  {
    path: 'components/listing/ListingDetails.tsx',
    reason:
      'Orphaned listing component — same class as ListingSummary.tsx. Zero importers ' +
      'confirmed. Contains .toLocaleString() render-body date formatting (hydration risk, P2.3).',
  },

  // ----- Orphaned geo MarketStats client components -----
  // These three components called reportsExploreYtdPath() from lib/slug.ts which
  // reads new Date() in the render body — a confirmed hydration (#418) risk (P2.2).
  // All three have zero importers confirmed (2026-06-09 audit).
  {
    path: 'components/city/CityMarketStats.tsx',
    reason:
      'Orphaned geo market-stats component — zero importers confirmed. Calls ' +
      'reportsExploreYtdPath() (lib/slug.ts:89-91) in the render body, which reads ' +
      'new Date() -> confirmed hydration risk (P2.2). Not used by any live city page.',
  },
  {
    path: 'components/neighborhood/NeighborhoodMarketStats.tsx',
    reason:
      'Orphaned geo market-stats component — zero importers confirmed. Same ' +
      'reportsExploreYtdPath()/new Date() hydration risk as CityMarketStats.',
  },
  {
    path: 'components/community/CommunityMarketStats.tsx',
    reason:
      'Orphaned geo market-stats component — zero importers confirmed. Same ' +
      'reportsExploreYtdPath()/new Date() hydration risk as CityMarketStats.',
  },

  // ----- Retired /admin/expired-listings index components (2026-07-15) -----
  // The manual-research index at /admin/expired-listings was consolidated into
  // the /admin/expireds dashboard (the index page now redirects there). These
  // two components were used only by that index. The per-listing review detail
  // at /admin/expired-listings/[key] remains and does not use them.
  {
    path: 'app/admin/(protected)/expired-listings/ExpiredListingsClient.tsx',
    reason:
      'Spark backfill buttons for the retired expired-listings index. Zero ' +
      'importers confirmed after the index became a redirect to /admin/expireds.',
  },
  {
    path: 'app/admin/(protected)/expired-listings/ExpiredListingRow.tsx',
    reason:
      'Card/table row + inline contact editor for the retired expired-listings ' +
      'index. Zero importers confirmed after the index became a redirect to ' +
      '/admin/expireds.',
  },
  {
    path: 'components/admin/expired/ExpiredOutreachRow.client.tsx',
    reason:
      'Retired expired-outreach send button. Zero page importers. Send is ' +
      'sendProspectingIntro at /admin/prospecting.',
  },
  {
    path: 'components/admin/expired/ExpiredAuditActions.client.tsx',
    reason:
      'Retired expired-dashboard send island. Zero page importers. Send is Prospecting.',
  },
  {
    path: 'components/admin/fsbo/FsboActions.client.tsx',
    reason:
      'Retired FSBO-dashboard send island. Zero page importers. Send is Prospecting.',
  },
  {
    path: 'components/admin/SendDocDialog.client.tsx',
    reason:
      'Retired expired/FSBO compose dialog. Only the two deleted islands imported it.',
  },
  {
    path: 'app/admin/(protected)/crm/deals/_components/DealsBoard.tsx',
    reason:
      'CRM Pipeline kanban is retired. /admin/crm/deals* redirect to Closings. One deal entity.',
  },
  {
    path: 'app/admin/(protected)/crm/deals/_components/DealsSubBar.tsx',
    reason: 'Retired with DealsBoard. Closings is the deal board.',
  },
  {
    path: 'app/admin/(protected)/crm/deals/_components/DealDetailModal.tsx',
    reason: 'Retired with DealsBoard. Open the file from Closings or the person.',
  },
  {
    path: 'app/admin/(protected)/crm/deals/_components/DealsDialogs.tsx',
    reason: 'Retired with DealsBoard.',
  },
  {
    path: 'app/admin/(protected)/crm/deals/_components/ManagePipelines.tsx',
    reason: 'Pipeline config died with the standalone CRM deals board.',
  },
  {
    path: 'app/admin/(protected)/crm/deals/_components/PipelineFormDialog.tsx',
    reason: 'Retired with ManagePipelines.',
  },
  {
    path: 'app/admin/(protected)/crm/deals/_components/AddStageDialog.tsx',
    reason: 'Retired with ManagePipelines.',
  },
  {
    path: 'app/admin/(protected)/crm/deals/_components/StageEditDialog.tsx',
    reason: 'Retired with ManagePipelines.',
  },
  {
    path: 'app/admin/(protected)/crm/deals/_components/deal-detail-bits.tsx',
    reason: 'Retired with DealDetailModal.',
  },
  {
    path: 'app/admin/(protected)/crm/deals/[id]/DealHeader.tsx',
    reason: 'crm_deals detail islands retired. Bookmarks land on Closings.',
  },
  {
    path: 'app/admin/(protected)/crm/deals/[id]/DealFiles.tsx',
    reason: 'Retired with the CRM deal detail page.',
  },
  {
    path: 'app/admin/(protected)/crm/deals/[id]/DealCommission.tsx',
    reason: 'Retired with the CRM deal detail page.',
  },
  {
    path: 'app/admin/(protected)/crm/deals/[id]/DealMilestones.tsx',
    reason: 'Retired with the CRM deal detail page.',
  },
]

// ---------------------------------------------------------------------------
// Gate logic
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(new URL('.', import.meta.url).pathname, '..')

function checkFile(entry) {
  const abs = join(REPO_ROOT, entry.path)
  const exists = existsSync(abs)
  return { ...entry, exists, absPath: abs }
}

function main() {
  const results = DEAD_FILES.map(checkFile)
  const found = results.filter((r) => r.exists)

  if (JSON_OUT) {
    console.log(JSON.stringify({ results, foundCount: found.length }, null, 2))
    process.exit(found.length === 0 ? 0 : 1)
  }

  console.log('Dead-UI gate (curated)')
  console.log('======================')
  console.log()

  let allOk = true
  for (const r of results) {
    if (r.exists) {
      allOk = false
      console.log(`FAIL  ${r.path}`)
      console.log(`      Reason: ${r.reason}`)
      console.log(`      Fix:    rm ${r.path}  (verify zero importers first, then npx tsc --noEmit)`)
      console.log()
    } else {
      console.log(`OK    ${r.path}  (absent — good)`)
    }
  }

  console.log()
  if (allOk) {
    console.log('All deprecated/orphaned UI files are absent.')
    console.log(`(Checked ${results.length} curated entries.)`)
    process.exit(0)
  }

  console.log(`${found.length}/${results.length} dead file(s) found on disk.`)
  console.log('Dead components with old patterns linger as re-adoption vectors.')
  console.log('Delete them (rm, not git rm) after confirming zero importers + tsc clean.')
  process.exit(1)
}

main()

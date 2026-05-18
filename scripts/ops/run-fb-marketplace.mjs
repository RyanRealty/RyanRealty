#!/usr/bin/env node
/**
 * ops-fb-marketplace — FB Marketplace upload bundle stager
 * NOTE: FB API does NOT permit programmatic real-estate listing creation.
 * This handler produces a manual-upload bundle only. --live still produces the bundle.
 * Usage: node scripts/ops/run-fb-marketplace.mjs <payload.json> [--live] [--out <dir>]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCER = 'ops-fb-marketplace';

const args = process.argv.slice(2);
if (!args[0]) { console.error('Usage: run-fb-marketplace.mjs <payload.json> [--live] [--out <dir>]'); process.exit(1); }
const payloadPath = path.resolve(args[0]);
const live = args.includes('--live');
const rawPayload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

const REQUIRED = ['listing'];
const slug = rawPayload.target_slug || 'default';
const outDir = process.env.OUT_DIR || path.join(process.cwd(), 'out', PRODUCER, slug);
fs.mkdirSync(outDir, { recursive: true });

// ── missing-fields check ──────────────────────────────────────────────────────
const missing = REQUIRED.filter(f => !rawPayload[f]);
const listing = rawPayload.listing || {};
const listingRequired = ['street_number', 'street_name', 'city', 'list_price', 'bedrooms', 'bathrooms', 'sqft'];
listingRequired.forEach(f => { if (!listing[f]) missing.push(`listing.${f}`); });

if (missing.length > 0) {
  const msg = `# Missing fields for ${PRODUCER}\n\nRequired but absent:\n\n${missing.map(f => `- \`${f}\``).join('\n')}\n\n## Required payload shape\n\n\`\`\`json\n{\n  "listing": {\n    "street_number": "19496",\n    "street_name": "Tumalo Reservoir Rd",\n    "city": "Bend",\n    "state": "Oregon",\n    "zip": "97703",\n    "list_price": 1225000,\n    "bedrooms": 3,\n    "bathrooms": 3,\n    "sqft": 2325,\n    "lot_acres": 2.28,\n    "year_built": 1995,\n    "subdivision": "Tumalo",\n    "remarks_short": "...",\n    "primary_photo_url": "...",\n    "list_agent_name": "Matt Ryan",\n    "list_agent_email": "matt@ryan-realty.com"\n  }\n}\n\`\`\`\n\n## FB API Limitation\n\nFacebook Marketplace does not permit programmatic real-estate listing creation via API.\nThis producer creates a manual-upload bundle only.\n`;
  fs.writeFileSync(path.join(outDir, 'missing-fields.md'), msg);
  const stub = `# ${PRODUCER} — incomplete payload\n\nSee missing-fields.md for required fields.\n`;
  fs.writeFileSync(path.join(outDir, 'approval-prompt.md'), stub);
  fs.writeFileSync(path.join(outDir, 'commentary.md'), stub);
  fs.writeFileSync(path.join(outDir, 'dispatch-plan.md'), stub);
  fs.writeFileSync(path.join(outDir, 'payload.json'), JSON.stringify({ _incomplete: true, missing }, null, 2));
  console.log(`⚠  Missing fields: ${missing.join(', ')} — see ${outDir}/missing-fields.md`);
  writeSidecars(outDir, rawPayload, { valid: false, missing });
  process.exit(0);
}

const address = `${listing.street_number} ${listing.street_name}, ${listing.city}, ${listing.state || 'OR'} ${listing.zip || ''}`.trim();
const priceDisplay = `$${Number(listing.list_price).toLocaleString()}`;
const beds = listing.bedrooms;
const baths = listing.bathrooms;
const sqft = Number(listing.sqft).toLocaleString();
const acres = listing.lot_acres ? ` | ${listing.lot_acres} acres` : '';
const yr = listing.year_built ? ` | Built ${listing.year_built}` : '';
const sub = listing.subdivision ? ` | ${listing.subdivision}` : '';

// ── voice scan ────────────────────────────────────────────────────────────────
const BANNED = ['stunning', 'nestled', 'boasts', 'charming', 'breathtaking', 'must-see', 'dream home',
  'meticulously', 'turnkey', 'immaculate', 'gorgeous', 'cozy', 'spacious', 'luxurious', 'truly'];
const baseRemarks = listing.remarks_short || '';
const voiceHits = BANNED.filter(w => baseRemarks.toLowerCase().includes(w));

// ── build title (max 100 chars for FB) ───────────────────────────────────────
const title = `${listing.bedrooms}BD/${listing.bathrooms}BA · ${priceDisplay} · ${listing.street_number} ${listing.street_name} · ${listing.city}, OR`.slice(0, 100);

// ── build description ─────────────────────────────────────────────────────────
const description = `${address}

${priceDisplay} · ${beds} bed · ${baths} bath · ${sqft} sqft${acres}${yr}${sub}

${baseRemarks}

Listed by ${listing.list_agent_name || 'Matt Ryan'}, Ryan Realty — ryan-realty.com · 541.213.6706

Serious inquiries only. All square footage and data sourced from MLS and should be independently verified.`.trim();

// ── photos list ───────────────────────────────────────────────────────────────
const photos = [];
if (listing.primary_photo_url) photos.push({ label: '01 — Hero/Primary', url: listing.primary_photo_url });
if (listing.primary_photo_path) photos.push({ label: '01 — Hero/Primary (local)', path: listing.primary_photo_path });
if (rawPayload.brand_assets?.hero_photo_path) photos.push({ label: 'Brand hero photo', path: rawPayload.brand_assets.hero_photo_path });

const photosMarkdown = `# Photos for FB Marketplace upload

Upload these photos in order. FB Marketplace allows up to 24 photos.

${photos.map((p, i) => `## Photo ${i + 1}: ${p.label}\n${p.url ? `URL: ${p.url}` : `Local: ${p.path}`}`).join('\n\n')}

## Additional photos
Add remaining listing photos from your MLS photo set. Recommended order:
1. Exterior front (hero)
2. Living / main living area
3. Kitchen
4. Primary bedroom
5. Primary bath
6. Additional bedrooms
7. Yard / outdoor space
8. Aerial / drone (if available)
9. Views
10. Neighborhood / subdivision

Upload high-resolution originals (minimum 1200×900px). FB compresses on upload.
`;

// ── step-by-step upload instructions ─────────────────────────────────────────
const instructions = `# FB Marketplace Upload Instructions

## Why manual upload is required

Facebook's Graph API does not permit programmatic creation of real-estate listings on Marketplace.
All Marketplace listings must be created through the Facebook UI.

## Steps

1. Open Facebook.com or the Facebook mobile app
2. Click "Marketplace" in the left sidebar (desktop) or bottom nav (mobile)
3. Click "Create new listing" > "Home for sale or rent"
4. Fill in the fields using the values in \`title.txt\` and \`description.txt\`

### Field values

| Field | Value |
|---|---|
| Title | See \`title.txt\` |
| Price | ${priceDisplay} |
| Property type | House |
| Bedrooms | ${beds} |
| Bathrooms | ${baths} |
| Home size | ${sqft} sqft |
| Year built | ${listing.year_built || 'n/a'} |
| Address | ${address} |
| Description | See \`description.txt\` |

5. Upload photos in the order listed in \`photos-list.md\`
6. Set listing to "Public"
7. Click "Publish"

## After publishing

- Copy the Marketplace listing URL and paste it into the marketing_brain_actions row
- The listing auto-expires in 30 days — set a calendar reminder to renew
- Consider cross-posting to relevant Bend/Central Oregon community groups

## Contact routing

Marketplace messages route to Facebook Messenger. Forward any qualified leads to FUB:
- Tag in FUB: \`fb-marketplace-lead\`
- Assign to Matt Ryan

## Note on FUB integration

FB Marketplace does not support webhook lead-capture. Handle inquiries manually.
`;

fs.writeFileSync(path.join(outDir, 'title.txt'), title);
fs.writeFileSync(path.join(outDir, 'description.txt'), description);
fs.writeFileSync(path.join(outDir, 'photos-list.md'), photosMarkdown);
fs.writeFileSync(path.join(outDir, 'instructions.md'), instructions);

const approvalPrompt = `# Approval required — ${PRODUCER}

**Listing:** ${address}
**Price:** ${priceDisplay}
**Beds/Baths/Sqft:** ${beds}/${baths}/${sqft}
${voiceHits.length > 0 ? `\n⚠  **Voice check FAILED — banned words in remarks:** ${voiceHits.join(', ')}. Fix before uploading.\n` : ''}
## Bundle contents

- \`title.txt\` — FB title (${title.length}/100 chars)
- \`description.txt\` — Full listing description
- \`photos-list.md\` — Ordered photo upload list
- \`instructions.md\` — Step-by-step upload guide

## FB API limitation

Facebook Marketplace does NOT permit programmatic real-estate listing creation.
This is a manual-upload bundle. No API call is made regardless of --live flag.

## To approve and upload

1. Review the bundle artifacts in: \`${outDir}\`
2. Follow \`instructions.md\` to post manually
`;

const commentary = `# Commentary — ${PRODUCER}

## What changes
FB Marketplace listing bundle produced for ${address} at ${priceDisplay}.

## Why no API call
Facebook's Marketplace API explicitly prohibits real-estate listing creation.
Attempting to use Graph API for listing creation violates FB Platform Policy.
This is intentional — the bundle is the deliverable.

## Rollback plan
Unpublish the listing from Facebook Marketplace UI at any time.

## Estimated impact
Marketplace listings receive 100–500 views/week in the Bend area.
Supplemental to MLS exposure. No broker protection — only use for direct-seller listings.

## Downside
Uncontrolled contact: inquiries arrive in Messenger with no FUB tracking.
Manually forward qualified leads to FUB and tag \`fb-marketplace-lead\`.

## Voice check
${voiceHits.length > 0 ? `FAIL — banned words: ${voiceHits.join(', ')}` : 'PASS — no banned words detected'}
`;

const dispatchPlan = `# Dispatch plan — ${PRODUCER}

## No API dispatch

Facebook Marketplace API does not permit programmatic real-estate listing creation.
This producer creates a manual-upload bundle only.

## Bundle location

\`${outDir}\`

## Files to review

- \`title.txt\`
- \`description.txt\`
- \`photos-list.md\`
- \`instructions.md\`

## Mode

${live ? 'LIVE — bundle produced (no API call — this is intentional per FB API policy)' : 'DRY RUN — same bundle produced (no difference between dry-run and live for this handler)'}
`;

fs.writeFileSync(path.join(outDir, 'approval-prompt.md'), approvalPrompt);
fs.writeFileSync(path.join(outDir, 'commentary.md'), commentary);
fs.writeFileSync(path.join(outDir, 'dispatch-plan.md'), dispatchPlan);
fs.writeFileSync(path.join(outDir, 'payload.json'), JSON.stringify({ title, description, listing: rawPayload.listing }, null, 2));
writeSidecars(outDir, rawPayload, { valid: true, missing: [], voiceHits });

const modeLabel = live ? 'LIVE (bundle produced — no API call per FB policy)' : 'DRY RUN';
console.log(`✓ ${modeLabel} — FB Marketplace bundle written to ${outDir}`);
console.log(`  Files: title.txt, description.txt, photos-list.md, instructions.md`);

function writeSidecars(dir, payload, { valid, missing, voiceHits = [] }) {
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(dir, 'citations.json'), JSON.stringify({
    producer: PRODUCER, generated_at: now,
    sources: [
      { label: 'FB Marketplace Policy', url: 'https://www.facebook.com/policies/commerce/', note: 'Programmatic real-estate listing creation not permitted' },
      { label: 'Listing data', source: 'payload', listing_key: payload.listing?.listing_key || 'n/a' },
    ],
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'provenance.json'), JSON.stringify({
    producer: PRODUCER, payload_path: payloadPath, generated_at: now, live_mode: live, target_slug: slug, api_call: false,
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'design_scorecard.json'), JSON.stringify({
    producer: PRODUCER,
    checks: { payload_validates: valid, fields_populated: missing.length === 0, voice_clean: voiceHits.length === 0, api_policy_compliant: true },
    voice_hits: voiceHits, missing_fields: missing, score: valid && voiceHits.length === 0 ? 100 : 70,
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'card.json'), JSON.stringify({
    producer: PRODUCER, listing_address: payload.listing ? `${payload.listing.street_number} ${payload.listing.street_name}` : 'n/a',
    price: payload.listing?.list_price, target_slug: slug, generated_at: now, live, api_call: false, out_dir: dir,
  }, null, 2));
}

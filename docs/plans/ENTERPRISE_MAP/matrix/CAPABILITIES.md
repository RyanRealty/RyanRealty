# Capability matrix (SEED — not closed)

**Rule:** status SEED = needs cell-level evidence before synthesis may treat as VERIFIED.  
**Scale:** 0 Ether · 1 Spec · 2 Skeleton · 3 Working · 4 Reliable · 5 Productized  

| ID | Capability | Maturity (seed) | Evidence basis | Public risk | Broker product? | Notes / fall-off |
|----|------------|-----------------|----------------|-------------|-----------------|------------------|
| CAP-001 | Public Next site (routes) | 4 | 296 page.tsx paths; production Vercel | High | Yes (brand) | DNS cutover ops separate |
| CAP-002 | Search / map / homes-for-sale | 3–4 | app/search + rewrites; strong core | High | Yes | F7 MV OPEN; filter completeness PARTIAL |
| CAP-003 | Listing detail | 4 | app/listing + showcase components | High | Yes | Continuous polish |
| CAP-004 | Geo / KB pages | 3–4 | cities/communities/zip/schools/parks | High | Indirect | EXPERIENCE archetype uneven |
| CAP-005 | Market hub / reports | 3 | housing-market routes + market DAL | **Critical** | Yes | Shareable monthly artifact gap historically |
| CAP-006 | Stats engine (pulse/cache/DAL) | 4 | EVIDENCE-LOG: pulse 45; cache 12995; v3=12920 v4=0 | **Critical** | Yes | **VERIFIED** served v3; never bypass |
| CAP-007 | MLS sync (Spark→listings) | 3–4 | sync crons; admin/sync; ~595k listings | High | Yes | Multi-lane ops complexity |
| CAP-008 | Lead capture / money paths | 3–4 | LPs + CRM ensureNativeLead | **Critical** | Yes | Historical LP enroll defects — re-verify |
| CAP-009 | Native CRM | 3–4 | 22977 people; stage dist EVIDENCE-LOG | High | **Yes** | **VERIFIED** stages collapse to Nurture-heavy; multi-broker risk historical |
| CAP-010 | Sequences / sends | 3–4 | crm-sequence-engine + Twilio/Resend | **Critical** | Yes | Measure weaker than suppress historically |
| CAP-011 | CRM inbox | 3 | Active Claude 11F work; full CAP in map | High | Yes | **IN SCOPE always**; parallel session owns *edits* only — re-census when landed |
| CAP-012 | TC / closings | 2–3 | tc_* + admin closings; SkySlope integrated | High | Yes | TC_BUILDOUT PAUSED |
| CAP-013 | CMA / BPO | 3–4 | 266 cmas; public deliverable routes | High | Yes | Production pipeline PARTIAL |
| CAP-014 | Expired / FSBO prospecting | 3–4 | 247 expired; processor via sync-delta | Med-High | Yes | **VERIFIED** unscheduled detect-expired is intentional |
| CAP-015 | Marketing brain pipeline | 3 | EVIDENCE-LOG; 0/20 executed have published_posts | Med | Partial | **VERIFIED** measure finds zero candidates — publish payload gap |
| CAP-016 | Content producers / social skills | 3 | 119 skills; REGISTRY | Med | Partial | Many NO_SCRIPT; video out of registry |
| CAP-017 | Video productized pipeline | 1–2 | Remotion on disk; §4 rules | Med | Partial | Not brain-shipped |
| CAP-018 | Meta ads / CAPI / audiences | 3–4 | env + webhooks + crons | High | Indirect | Spend Matt-gated |
| CAP-019 | Multi-social OAuth publish | 2–3 | auth rows: LI/TT/YT/X/GBP=1; Threads/Pin/ND=0 | Med | **Premium thesis** | Uneven connect |
| CAP-020 | Newsletter | 3 code / blocked ops | crons + admin | Med | Yes | First cohort Matt-blocked |
| CAP-021 | Broker public pages /team | 3 | routes exist | High | **Yes** | “Dialed” bar not closed |
| CAP-022 | Broker platform / onboarding | 1–2 | 3 brokers | — | **Core thesis** | Not productized for recruit |
| CAP-023 | Consumer portal /account | 3 | account routes | Med | No | |
| CAP-024 | Admin Product OS shell | 4 | **143** pages import v2 of 170 | Low public | Ops | **VERIFIED** import census; 27 without |
| CAP-025 | Admin token purity (11F) | 3 | 27 pages no v2 import; inbox in flight | Low public | Ops | Q-admin-without-v2-import.txt; Claude owns inbox |
| CAP-026 | Design system public | 3–4 | design_system/ryan-realty + gates | High | Brand | Frankenstein residue |
| CAP-027 | Design system admin v2 | 3 | components/admin/v2 | Ops | Ops | Rolling with 11F |
| CAP-028 | Brand voice enforcement | 3–4 | VOICE.md + ci:brand-voice | High | Yes | Rewrite surface PARTIAL |
| CAP-029 | AEO / SEO plumbing | 4 | llms.txt, JSON-LD, seo gates | High | Indirect | Defend continuously |
| CAP-030 | Westside growth program | 2–3 | WESTSIDE_BACKLOG live | High | Indirect | Content/authority open |
| CAP-031 | Analytics fabric (GA4/GSC/ads snapshots) | 3–4 | many marketing-snapshot-* | Med | Ops | Several snapshots on dark list (fan-out?) |
| CAP-032 | Agent / process OS | 3 | LOOP + gates + skills | — | — | Fleet map not yet mandatory start |
| CAP-033 | Grok memory | 2 | enabled + seeded 2026-08-08 | — | — | Assist only; not SoR |
| CAP-034 | DSCR tool | 3 | /admin/dscr | Low | Niche | |
| CAP-035 | Broker SMS agent | 2–3 | plan + lib/agent | Med | Yes | DoD incomplete |

## Aggregate seed (not a scorecard of done)

- **Strong (≈4):** public site core, stats engine access model, AEO, admin shell, large CRM shape  
- **Working but incomplete (≈3):** search/filter/F7, TC, brain learning loop, multi-social, newsletter ops, voice rewrite, westside  
- **Thesis lag (≈1–2):** broker productization, video as product, full graph workflows  

This matrix is **SEED**. Cell-by-cell VERIFIED requires path probes, not this table alone.

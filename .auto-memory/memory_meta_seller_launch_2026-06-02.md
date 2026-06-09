# Meta Seller-Ad Launch — Phase 1 LIVE (2026-06-02)

**⚠️ LIVE PAID SPEND.** T2A is running at $20/day. Pause = POST status=PAUSED to the campaign/adset.

## What's live
| Item | Value |
|---|---|
| Campaign | RR — Tier 2A — Bend Resident TOFU · `120244223739790698` · ACTIVE · HOUSING |
| Ad set | `120244224332950698` · ACTIVE · $20/day · OFFSITE_CONVERSIONS · dest WEBSITE · pixel LEAD |
| Audience (include) | `120244514285040698` RR Premium Sellers (1st-party) |
| Exclusions | `120244223042110698` Hard-Stop (realtors+compliance) + `120244510686080698` warm-sellers (funnel hygiene) |
| Ads | `120244541897180698` would-bring (#19) + `120244541992500698` out-of-state (#08) — v10 multi-placement (1:1+4:5+9:16) |
| Funnel | ad → ryan-realty.com/lp/seller-home-value → FUB Seller Inquiry + CAPI Lead ($500) + fbq Lead (deduped) |
| Pixel | `1546878946032105` ryan-realty.com (CAPI smoke test passed — events_received 1) |
| Ad account | `act_1178780510184911` · auto-bill VISA *6787 · acct spend_cap $14,000 |

## Phasing (agreed)
- **Phase 1 (now, 7 days):** T2A only, $20/day. Leave it alone (learning phase). Target CPL $20–60.
- **Phase 2 (day 7–14, if CPL healthy):** turn on T4 (retargeting), T5 (BOFU hot), T3 (absentee). Needs per-tier v10 ad picks wired + rendered in 3 sizes first.
- **Phase 3 (day 14+):** scale winners +20%/week, add T2B + T1, build Special Ad Audience LAL (UI-only — standard LALs blocked under HOUSING).

## Still PAUSED (other tiers — need ads wired for Phase 2)
T1 `120244223736960698` · T2B `120244223741480698` · T3 `120244223742330698` · T4 `120244223743080698` · T5 `120244223745230698`. T3/T4/T5 have NO ads attached yet.

## Creative source
v10 set: `out/seller-ad-concepts/v10/` (30 variants + multisize/). Re-pick sheet: `REPICK.html`. Generator: `scripts/_render-seller-ads-v10.mjs` (edit MULTISIZE array → re-run to render any pick in 4:5 + 9:16). Matt approved all 30 as creative-quality 2026-06-02.

## Open / next
- Monitor: ads clear review → delivery → first Lead event → FUB person → CPL. Pause if CPL wild or webhook breaks.
- Per-tier v10 ad assignment for Phase 2 (Matt to pick numbers per tier, or agent assigns best-fit).
- FUB 10-touch nurture drip (action plan + custom fields + pause-on-reply cron) — build before Phase 2 scales volume. Phase 1's small trickle is handled manually + lands in FUB tagged audience:seller.
- Note: out-of-state (#08) is an absentee angle on a resident audience — Meta will favor the better performer; rebalance in Phase 2.

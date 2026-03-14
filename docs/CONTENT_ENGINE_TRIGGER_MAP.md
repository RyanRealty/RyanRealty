# Content Engine Trigger Map

**Which database/sync events generate which content types, for which platforms.**  
Use this when implementing the Automated Social Media Content Engine.

---

## Event → Content Type → Platform Matrix

| Trigger event | Content type | Instagram | Reels | Facebook | TikTok | LinkedIn | X (Twitter) | Notes |
|---------------|--------------|:--------:|:-----:|:--------:|:------:|:--------:|:-----------:|-------|
| **New listing syncs** | New Listing Alert | ✓ | ✓* | ✓ | ✓* | — | — | Photo + stats + price + community + link. Video-first if listing has video URL. *Reels/TikTok when video available. |
| **Listing → Finalized Closed** | Just Sold Announcement | ✓ | — | ✓ | — | — | — | Sold price, DOM, above/below list. Oregon/MLS compliant. |
| **Price reduction syncs** | Price Drop Alert | ✓ | ✓* | ✓ | ✓* | — | ✓ | Original/new price, % drop. Urgency by reduction size. *Short-form when video. |
| **Listing → Pending** | Under Contract Announcement | ✓ | — | ✓ | — | — | ✓ | Simple, clean. Velocity + social proof. |
| **Scheduled (weekly/monthly)** | Market Trend Summary | — | — | ✓ | — | ✓ | ✓ | From pre-computed stats. City/neighborhood/community. Median price, inventory, absorption, DOM. |
| **Community threshold crossed** | Hot Community Alert | ✓ | — | ✓ | ✓ | ✓ | ✓ | e.g. all under contract in 7 days; zero active. Insight, not hype. |
| **Geography appreciation milestone** | Price Appreciation Milestone | — | — | ✓ | — | ✓ | — | YoY or multi-year. Strong on LinkedIn/Facebook. |
| **High saves/likes/views (listing)** | Interest-Based Amplification | ✓ | ✓* | ✓ | ✓* | — | ✓ | “This one’s getting a lot of attention.” *When video. |
| **Traffic spike (community page)** | Community Interest Post | ✓ | — | ✓ | ✓ | ✓ | ✓ | Post about that community. |
| **Seasonal / calendar** | Seasonal & Calendar Content | ✓ | ✓* | ✓ | ✓* | ✓ | ✓ | Spring preview, fall inventory, ski-season, etc. *Video when produced. |
| **Listing has video URL** | Video-first New Listing / Sold / Price Drop | ✓ | ✓ | ✓ | ✓ | — | — | Use SPARK video as primary asset. |
| **No video; high-quality photos** | AI-generated short-form video | ✓ | ✓ | ✓ | ✓ | — | — | Pan/zoom, transitions, text, music. Queued for broker review. |

---

## Trigger Source (Where Events Come From)

| Source | Event(s) | Feeds content engine? |
|--------|----------|------------------------|
| **Sync: new listing** | New listing in SPARK not in DB (or new to active) | Yes → New Listing Alert |
| **Sync: status change → Pending** | StandardStatus / MlsStatus → Pending/Under Contract | Yes → Under Contract Announcement |
| **Sync: status change → Closed** | Listing closed; when finalized | Yes → Just Sold Announcement |
| **Sync: price change** | ListPrice reduced (from listing_history or current vs previous) | Yes → Price Drop Alert |
| **Pre-computed stats job** | After sync; affected geographies only | Yes → Market Trend Summary (scheduled), Hot Community, Appreciation Milestone |
| **User behavior (saves/likes/views)** | Aggregated per listing / per page | Yes → Interest-Based, Community Interest |
| **Scheduler** | Weekly, monthly, seasonal | Yes → Market Trend, Seasonal |
| **AI video pipeline** | Listing with photos, no video | Yes → Generated video queued for review |

---

## Platform Sizing and Format (Quick Reference)

| Platform | Image/video specs | Caption style |
|----------|-------------------|---------------|
| **Instagram** | Square or 4:5; Reels 9:16, &lt;30s | Short, punchy; hook in first line; CTA + link in bio or direct link |
| **Facebook** | 1.91:1 or square; video &lt;1 min for feed | Longer, narrative; local specificity; invite reaction/share |
| **TikTok** | 9:16, &lt;30s ideal | Immediate hook in first 3 seconds; text overlay; no sound required |
| **LinkedIn** | 1.91:1 or square; professional | Data-forward, market authority, appreciation/trends |
| **X (Twitter)** | 16:9 or 1:1; short clips | Short, punchy stats; rapid commentary |

---

## Hashtag Rules (From Master Set)

- **Always include (brand):** #RyanRealtyBend #BendOregon #BendRealEstate #CentralOregon #BendHomes #BendLife #QualityLocalService  
- **By event:** #JustListed #JustSold #PriceDrop #UnderContract (where appropriate)  
- **By geography:** #Tetherow #SunriverOregon etc. for community-specific content  
- **By content type:** Add listing type, price range, market event as relevant  

---

## Compliance Gate

| Content type | Auto-publish allowed? | Mandatory review? |
|--------------|------------------------|-------------------|
| New Listing Alert | Yes (if broker enables) | Optional |
| Just Sold | No | Yes — confirm no confidential terms, MLS/Oregon compliant |
| Price Drop | Yes | Optional |
| Under Contract | Yes | Optional |
| Market Trend / Hot Community / Appreciation | Yes | Optional |
| Interest-Based / Seasonal | Yes | Optional |
| AI-generated video | No | Yes — before first publish |

---

## Content Dashboard → Publish Flow

1. **Event occurs** → Engine generates asset(s) + caption(s) + hashtags per platform.  
2. **Piece appears in queue** → Preview, platform(s), trigger event, caption, hashtags, deep link.  
3. **Broker action:** Approve & schedule, **Edit then approve**, or Dismiss.  
4. **Auto-publish (configurable):** If not acted on in window → publish or expire.  
5. **Single-tap share** to connected accounts (OAuth: Instagram, Facebook, LinkedIn, optionally TikTok, X).  
6. **Performance pull-back** (where APIs allow) → likes, shares, comments, link clicks → feed back into engine weighting.

---


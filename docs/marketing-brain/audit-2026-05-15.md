# Marketing brain — competitive audit 2026-05-15-v2

Generated: 2026-05-15T16:25:26.158Z
Window: 180 days
Scope: 19 of 19 competitors with data; instagram, tiktok, facebook, google_serp, google_maps_reviews
Posts classified: 270
Cost: Apify $0.05 + Classifier $0.00

---

## Headline summary

- Competitors scraped: 19
- Competitors with data: 19
- Posts classified: 270
- Missing producers identified: 4
- Existing producers validated: 3
- Total Apify cost: $0.05

## Top winners by topic × format

| Topic | Format | Posts | p75 ER | Median ER | Competitors |
|---|---|---|---|---|---|
| agent_brand | reel | 6 | 0.098 | 0.001 | glennda_baker, offerpad, ryan_serhant |
| other | reel | 81 | 0.006 | 0.001 | chad_carroll, compass_corp, glennda_baker |
| behind_scenes | single_image | 5 | 0.003 | 0.002 | compass_corp, offerpad, ryan_serhant |
| other | single_image | 56 | 0.003 | 0.001 | chad_carroll, compass_corp, glennda_baker |
| agent_brand | single_image | 7 | 0.002 | 0.001 | chad_carroll, compass_corp, offerpad |
| listing | single_image | 16 | 0.002 | 0.001 | chad_carroll, compass_corp, offerpad |
| listing | reel | 31 | 0.000 | 0.000 | chad_carroll, glennda_baker, ryan_serhant |

## Missing producers (priority order)

### `other-reel` — HIGH

- **Path:** `video_production_skills/other-reel/`
- **Action type:** `content:other_reel`
- **Topic × Format:** other × reel
- **Evidence:** 81 posts at p75 ER 0.006; competitors: chad_carroll, compass_corp, glennda_baker, ktvz, madison_sutton
- **Data sources:** (none)
  - https://www.tiktok.com/@sothebysrealty/video/7239454407287524654
  - https://www.tiktok.com/@ryanserhant/video/7506951442171694378
  - https://www.tiktok.com/@glenndabaker/video/6962094027445619973

### `other-single_image` — HIGH

- **Path:** `social_media_skills/other-single_image/`
- **Action type:** `content:other_single_image`
- **Topic × Format:** other × single_image
- **Evidence:** 56 posts at p75 ER 0.003; competitors: chad_carroll, compass_corp, glennda_baker, offerpad, opendoor
- **Data sources:** (none)
  - https://www.instagram.com/p/DKCfYT9OhQ0/
  - https://www.instagram.com/p/DQ4OczJEbKH/
  - https://www.instagram.com/p/DYDONuGGeGk/

### `agent-brand-reel` — LOW

- **Path:** `video_production_skills/agent-brand-reel/`
- **Action type:** `content:agent_brand_reel`
- **Topic × Format:** agent_brand × reel
- **Evidence:** 6 posts at p75 ER 0.098; competitors: glennda_baker, offerpad, ryan_serhant, sothebys_corp, tom_ferry
- **Data sources:** press mentions, internal team data
- **Closest existing:** `social_media_skills/instagram-carousel`
  - https://www.tiktok.com/@offerpad/video/7355527044639231274
  - https://www.tiktok.com/@offerpad/video/7361048842399124779
  - https://www.tiktok.com/@tomferry/video/7603400331514350862

### `behind-scenes-single_image` — LOW

- **Path:** `social_media_skills/behind-scenes-single_image/`
- **Action type:** `content:behind_scenes_single_image`
- **Topic × Format:** behind_scenes × single_image
- **Evidence:** 5 posts at p75 ER 0.003; competitors: compass_corp, offerpad, ryan_serhant
- **Data sources:** broker journals, FUB pipeline (anonymized)
- **Closest existing:** `video_production_skills/listing_reveal`
  - https://www.instagram.com/p/DTtSIfUjrG5/
  - https://www.instagram.com/p/DIPDreqqP5o/
  - https://www.instagram.com/p/DH9SlNxRwrZ/

## Existing producers validated

| Producer | Recommendation | Evidence |
|---|---|---|
| `social_media_skills/flyer-design` | keep | agent_brand/single_image: 7 posts, median ER 0.001 |
| `social_media_skills/flyer-design` | keep | listing/single_image: 16 posts, median ER 0.001 |
| `video_production_skills/listing_reveal` | keep | listing/reel: 31 posts, median ER 0.000 |

## Outliers flagged

- **agent_brand/reel** [small_sample]: Only 6 posts in corpus for agent_brand/reel.
- **behind_scenes/single_image** [small_sample]: Only 5 posts in corpus for behind_scenes/single_image.
- **agent_brand/single_image** [small_sample]: Only 7 posts in corpus for agent_brand/single_image.

## Errors during run

- cascade_hasson_sothebys/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- windermere_central_oregon/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- cascade_sothebys/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- coldwell_banker_bain_bend/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- john_l_scott_bend/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- remax_key_properties_bend/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- opendoor/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- offerpad/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- ryan_serhant/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- compass_corp/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- sothebys_corp/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- tom_ferry/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- visit_bend/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- source_weekly/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- cascade_business_news/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- ktvz/fb_ad_library: Apify start apify/facebook-ads-scraper failed (400): {
  "error": {
    "type": "invalid-input",
    "message": "Input is not valid: Field input.startUrls is required"
  }
}
- Classification batch 200: canceling statement due to statement timeout

---

Per [PROTOCOL.md](../../marketing_brain_skills/audit-findings/PROTOCOL.md), Producer Authoring queries marketing_brain_actions WHERE action_type='analyze:audit_findings' AND status='approved' ORDER BY created_at DESC LIMIT 1 to pick its next work.
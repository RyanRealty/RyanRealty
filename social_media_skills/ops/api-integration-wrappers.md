---
name: api-integration-wrappers
description: Ryan Realty: API Integration Wrappers Skill
---
# Ryan Realty: API Integration Wrappers Skill

## When to Use

Use this skill when you need to call external APIs for social media publishing, lead capture, email delivery, insights, or analytics. This is the cheat sheet for Matt's existing API keys and how to use them without reinventing the wheel.

## Fundamental Architecture: Two Paths

### Path A: Inline API Calls (Fast, One-Off)

Write raw API calls in agent scripts when the task is a one-time action (post a single video, add one lead). Use fetch or curl directly.

**Pros:** No infrastructure overhead, immediate results
**Cons:** Error handling must be inline, no request queuing, secrets exposed if not careful

### Path B: Next.js API Routes (Reusable, Batched)

Build thin wrapper routes under `RyanRealty/app/api/social/*` for recurring tasks (batch post series, polling insights, lead sync). These routes:
- Centralize error handling and logging
- Rate-limit safely (Upstash Redis backing)
- Queue jobs (Inngest support)
- Can be called from agent scripts or CLI

**Pros:** Reusable, safe, auditable, batches for efficiency
**Cons:** Requires Next.js project setup (already in place)

## 15 Essential API Recipes

---

## 1. Instagram Graph API: Publish Reel

**Purpose:** Post a video reel directly to IG feed

**Auth:** META_PAGE_ACCESS_TOKEN, META_IG_BUSINESS_ACCOUNT_ID

**Endpoint:** Two-step: POST container, then publish

**Code (Node.js Fetch):**

```javascript
const publishInstagramReel = async (videoUrl, caption) => {
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
  const igUserId = process.env.META_IG_BUSINESS_ACCOUNT_ID;
  
  // Step 1: Create media container
  const containerRes = await fetch(
    `https://graph.instagram.com/v18.0/${igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "REELS",
        video_url: videoUrl, // Must be publicly accessible HTTPS URL
        caption: caption,
        share_to_feed: true, // Post to feed, not just Reels tab
        access_token: pageAccessToken
      })
    }
  );
  
  const container = await containerRes.json();
  if (!container.id) throw new Error(`Container creation failed: ${container.error?.message}`);
  
  // Step 2: Publish (within 24 hours of container creation)
  const publishRes = await fetch(
    `https://graph.instagram.com/v18.0/${igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_id: container.id,
        access_token: pageAccessToken
      })
    }
  );
  
  const published = await publishRes.json();
  return published.id; // IG media ID
};
```

**Curl Example:**

```bash
# Step 1: Create container
curl -X POST https://graph.instagram.com/v18.0/$META_IG_BUSINESS_ACCOUNT_ID/media \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "REELS",
    "video_url": "https://example.com/reel.mp4",
    "caption": "DM me strategy",
    "access_token": "'$META_PAGE_ACCESS_TOKEN'"
  }'

# Step 2: Publish
curl -X POST https://graph.instagram.com/v18.0/$META_IG_BUSINESS_ACCOUNT_ID/media_publish \
  -H "Content-Type: application/json" \
  -d '{
    "media_id": "CONTAINER_ID_FROM_STEP_1",
    "access_token": "'$META_PAGE_ACCESS_TOKEN'"
  }'
```

**Key Gotchas:**
- Video URL must be publicly accessible (not localhost)
- Container must be published within 24 hours
- Caption max 2,200 characters
- Hashtags count toward caption length (limit to 10-15)

**Expected Latency:** 5-10 seconds total

**Docs:** [Meta Graph API IG Media](https://developers.facebook.com/docs/instagram-graph-api/reference/ig-media)

---

## 2. Instagram Graph API: Pull Reel Insights

**Purpose:** Get performance data for a published reel

**Auth:** META_PAGE_ACCESS_TOKEN

**Endpoint:** GET /{media_id}/insights

**Code (Node.js):**

```javascript
const getReelInsights = async (mediaId) => {
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
  
  const metrics = [
    "plays", // Video views
    "reach", // Unique reach
    "saved", // Save count
    "shares", // Shares
    "comments", // Comment count
    "likes", // Like count
    "total_interactions", // All engagement
    "ig_reels_avg_watch_time" // Avg seconds watched
  ];
  
  const response = await fetch(
    `https://graph.instagram.com/v18.0/${mediaId}/insights?metric=${metrics.join(",")}&access_token=${pageAccessToken}`
  );
  
  const data = await response.json();
  
  // Format for storage
  return {
    mediaId: mediaId,
    pulledAt: new Date().toISOString(),
    metrics: data.data.reduce((acc, m) => {
      acc[m.name] = m.values?.[0]?.value || 0;
      return acc;
    }, {})
  };
};
```

**Store in Supabase:**

```javascript
const storeReelMetrics = async (metrics) => {
  const { data, error } = await supabase
    .from("social_metrics_weekly")
    .insert({
      platform: "instagram",
      content_type: "reel",
      media_id: metrics.mediaId,
      plays: metrics.metrics.plays,
      reach: metrics.metrics.reach,
      engagement: metrics.metrics.total_interactions,
      avg_watch_time: metrics.metrics.ig_reels_avg_watch_time,
      pulled_at: metrics.pulledAt
    });
  
  if (error) console.error("Metrics insert failed:", error);
  return data;
};
```

**Expected Latency:** 2-3 seconds

**Docs:** [IG Media Insights](https://developers.facebook.com/docs/instagram-graph-api/reference/ig-media/insights)

---

## 3. Facebook Page: Publish Reel

**Purpose:** Post a video reel to Facebook business page

**Auth:** META_PAGE_ACCESS_TOKEN, META_FB_PAGE_ID

**Endpoint:** POST /{page_id}/video_reels

**Code (Node.js):**

```javascript
const publishFacebookReel = async (videoUrl, caption) => {
  const pageId = process.env.META_FB_PAGE_ID;
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
  
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${pageId}/video_reels`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_url: videoUrl,
        description: caption,
        published: true, // Publish immediately
        access_token: pageAccessToken
      })
    }
  );
  
  const result = await response.json();
  return result.id;
};
```

**Expected Latency:** 5-15 seconds

---

## 4. Follow Up Boss: Create Lead from IG DM

**Purpose:** When someone DMs "strategy", capture them as a lead in FUB

**Auth:** FOLLOWUPBOSS_API_KEY (use as Basic auth username)

**Endpoint:** POST https://api.followupboss.com/v1/people

**Code (Node.js):**

```javascript
const createFUBLead = async (firstName, lastName, email, igDmSource) => {
  const fubKey = process.env.FOLLOWUPBOSS_API_KEY;
  const auth = Buffer.from(`${fubKey}:`).toString("base64");
  
  const response = await fetch("https://api.followupboss.com/v1/people", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      firstName: firstName,
      lastName: lastName,
      emails: [{ value: email }],
      source: "Instagram DM",
      tags: ["Social Lead", "Market Strategy"],
      customFields: {
        "dm_keyword": igDmSource // e.g., "strategy", "tour", "Bend"
      }
    })
  });
  
  const lead = await response.json();
  return lead.id;
};
```

**Expected Latency:** 1-2 seconds

**Docs:** [FUB People API](https://api.followupboss.com/docs/people)

---

## 5. Follow Up Boss: Add Lead to Action Plan

**Purpose:** Enroll newly captured lead into nurture sequence

**Auth:** FOLLOWUPBOSS_API_KEY

**Code (Node.js):**

```javascript
const addLeadToActionPlan = async (personId, actionPlanId) => {
  const fubKey = process.env.FOLLOWUPBOSS_API_KEY;
  const auth = Buffer.from(`${fubKey}:`).toString("base64");
  
  const response = await fetch(
    "https://api.followupboss.com/v1/actionPlansPeople",
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personId: personId,
        actionPlanId: actionPlanId, // Matt's nurture sequence IDs
        enrollAt: new Date().toISOString()
      })
    }
  );
  
  return await response.json();
};
```

---

## 6. Resend: Send Follow-Up Email

**Purpose:** Send templated nurture email to IG DM lead

**Auth:** RESEND_API_KEY

**Endpoint:** POST https://api.resend.com/emails

**Code (Node.js):**

```javascript
const sendResendEmail = async (toEmail, firstName, dmKeyword) => {
  const resendKey = process.env.RESEND_API_KEY;
  
  // Select template based on keyword
  const templates = {
    "strategy": {
      subject: "Your personalized Bend market strategy",
      html: `<h2>Hi ${firstName},</h2>
             <p>You asked about strategy. Here's what the current market shows...</p>
             <a href="https://ryan-realty.com/strategy-guide">Download Full Guide</a>`
    },
    "tour": {
      subject: "Let's schedule your property tour",
      html: `<h2>Hi ${firstName},</h2>
             <p>Ready to see the home? Pick a time that works...</p>
             <a href="https://calendly.com/mattbyan/tour">Book Tour</a>`
    },
    "Bend": {
      subject: "Why people love living in Bend",
      html: `<h2>Hi ${firstName},</h2>
             <p>Thinking about Bend? Here's what locals know...</p>`
    }
  };
  
  const template = templates[dmKeyword] || templates["strategy"];
  
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Matt Ryan <matt@ryan-realty.com>",
      to: toEmail,
      subject: template.subject,
      html: template.html
    })
  });
  
  const result = await response.json();
  return result.id; // Email ID
};
```

**Expected Latency:** 2-3 seconds

**Docs:** [Resend API](https://resend.com/docs/api-reference/emails/send)

---

## 7. Replicate: Run Kling Photo-to-Video

**Purpose:** Generate AI video from static image (covered in ai-video-production.md, included here for completeness)

**Auth:** REPLICATE_API_TOKEN

**Endpoint:** POST https://api.replicate.com/v1/predictions

**Code (Node.js):**

```javascript
const generateKlingVideo = async (imageUrl, prompt) => {
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Token ${replicateToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: "kwaivgi/kling-v1-6-standard",
      input: {
        image_url: imageUrl,
        prompt: prompt,
        duration: 5,
        aspect_ratio: "9:16"
      }
    })
  });
  
  const prediction = await response.json();
  return prediction.id; // Poll this for status
};

// Poll for completion
const pollKlingVideo = async (predictionId) => {
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  let done = false;
  
  while (!done) {
    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      { headers: { "Authorization": `Token ${replicateToken}` } }
    );
    const prediction = await response.json();
    
    if (prediction.status === "succeeded") {
      return prediction.output; // Video URL
    } else if (prediction.status === "failed") {
      throw new Error(prediction.error);
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
};
```

**Expected Latency:** 30-60 seconds + polling

---

## 8. Synthesia: Generate Avatar Video

**Purpose:** Create AI avatar video (covered in synthesia-avatar-workflow.md, included here for completeness)

**Auth:** SYNTHESIA_API_KEY

**Endpoint:** POST https://api.synthesia.io/v2/videos

**Code (Node.js):**

```javascript
const generateSynthesiaVideo = async (script, backgroundUrl) => {
  const synthesiaKey = process.env.SYNTHESIA_API_KEY;
  const avatarId = process.env.SYNTHESIA_AVATAR_ID;
  
  const response = await fetch("https://api.synthesia.io/v2/videos", {
    method: "POST",
    headers: {
      "Authorization": synthesiaKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: "Market Update",
      avatar: { id: avatarId },
      background: {
        type: "image",
        image_url: backgroundUrl
      },
      script: script,
      quality: "high"
    })
  });
  
  const video = await response.json();
  return video.id; // Poll for completion
};
```

**Expected Latency:** 2-3 minutes

---

## 9. Google Business Profile: Post "What's New"

**Purpose:** Publish a "What's New" post to Matt's Google Business listing

**Auth:** Google Service Account (GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)

**Endpoint:** POST accounts.locations.localPosts.create

**Code (Node.js, requires @google-cloud/business-profile-service):**

```javascript
const publishGoogleBusinessPost = async (title, description, photoUrl) => {
  const { google } = require("googleapis");
  
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_id: "unused"
    },
    scopes: ["https://www.googleapis.com/auth/business.manage"]
  });
  
  const businessProfileService = google.mybusinesslocalpost({ version: "v1", auth });
  
  // First, get Matt's location ID
  const accountId = "MATT_ACCOUNT_ID"; // Get from Google Business Profile
  const locationId = "LOCATION_ID"; // Get from Google Business Profile
  
  const response = await businessProfileService.accounts.locations.localPosts.create({
    parent: `accounts/${accountId}/locations/${locationId}`,
    requestBody: {
      summary: title,
      description: description,
      topicType: "MARKET_UPDATE", // or PRODUCT, EVENT, etc.
      media: photoUrl ? [{ mediaFormat: "PHOTO", sourceUrl: photoUrl }] : []
    }
  });
  
  return response.data;
};
```

**Expected Latency:** 3-5 seconds

**Docs:** [Google Business Profile API](https://developers.google.com/my-business/content/post-updates)

---

## 10. YouTube Data API: Upload Short

**Purpose:** Upload a short vertical video to Matt's YouTube channel

**Auth:** Google OAuth (user consent required) or Service Account

**Endpoint:** videos.insert (resumable upload)

**Code (Node.js):**

```javascript
const uploadYouTubeShort = async (videoFilePath, title, description) => {
  const { google } = require("googleapis");
  const fs = require("fs");
  
  const auth = new google.auth.GoogleAuth({
    keyFile: "path/to/service-account.json", // Or use user OAuth
    scopes: ["https://www.googleapis.com/auth/youtube.upload"]
  });
  
  const youtube = google.youtube({ version: "v3", auth });
  
  const response = await youtube.videos.insert({
    part: "snippet,status",
    notifySubscribers: false,
    requestBody: {
      snippet: {
        title: title,
        description: description,
        tags: ["BendOregon", "RealEstate"],
        categoryId: "22" // People & Blogs
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false
      }
    },
    media: {
      body: fs.createReadStream(videoFilePath)
    }
  });
  
  return response.data.id; // YouTube video ID
};
```

**Expected Latency:** 10-30 seconds (upload) + processing time

---

## 11. Google Sheets: Append Calendar Row

**Purpose:** Log a social post schedule to a Google Sheet

**Auth:** Google Service Account

**Code (Node.js, supabase-js wrapper):**

```javascript
const appendSheetRow = async (spreadsheetId, sheetName, rowData) => {
  const { google } = require("googleapis");
  
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  
  const sheets = google.sheets({ version: "v4", auth });
  
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range: `${sheetName}!A:G`,
    valueInputOption: "RAW",
    requestBody: {
      values: [rowData] // E.g., [["2026-04-20", "Reel", "Frost Crystals", "IG", "5s", "$0.02", "Draft"]]
    }
  });
  
  return response.data;
};
```

**Expected Latency:** 2-3 seconds

---

## 12. Supabase: Write Metric Row

**Purpose:** Store reel insights or lead metrics to Supabase

**Auth:** SUPABASE_SERVICE_ROLE_KEY (via supabase-js)

**Code (Node.js):**

```javascript
const insertMetric = async (table, record) => {
  const { createClient } = require("@supabase/supabase-js");
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { data, error } = await supabase
    .from(table)
    .insert(record);
  
  if (error) throw error;
  return data;
};

// Usage: insertMetric("social_metrics_weekly", {
//   platform: "instagram",
//   media_id: "123",
//   plays: 450,
//   reach: 320,
//   engagement: 28
// })
```

**Expected Latency:** 1-2 seconds

---

## 13. Meta CAPI: Log Lead Conversion

**Purpose:** Send lead event to Meta pixel for ad learning (conversion optimization)

**Auth:** META_CAPI_ACCESS_TOKEN, NEXT_PUBLIC_META_PIXEL_ID

**Endpoint:** POST /{pixel_id}/events

**Code (Node.js):**

```javascript
const logLeadConversionToMeta = async (email, firstName, conversionValue) => {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const capiToken = process.env.META_CAPI_ACCESS_TOKEN;
  
  // Hash PII for CAPI (required)
  const crypto = require("crypto");
  const hashEmail = crypto
    .createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex");
  
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${pixelId}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          {
            event_name: "Lead", // Standard event
            event_time: Math.floor(Date.now() / 1000),
            user_data: {
              em: hashEmail, // Hashed email
              fn: firstName?.toLowerCase() || ""
            },
            event_source_url: "https://ryan-realty.com",
            event_id: `lead_${Date.now()}`, // Deduplication ID
            custom_data: {
              value: conversionValue || "1.0", // Lead value
              currency: "USD"
            }
          }
        ],
        access_token: capiToken
      })
    }
  );
  
  return await response.json();
};
```

**Expected Latency:** 1-2 seconds

**Docs:** [Meta CAPI Events](https://developers.facebook.com/docs/marketing-api/conversion-api/get-started)

---

## 14. Unsplash: Fetch Stock Images

**Purpose:** Pull stock photos for AI video B-roll or static posts

**Auth:** UNSPLASH_ACCESS_KEY

**Endpoint:** GET /photos/random

**Code (Node.js):**

```javascript
const getUnsplashPhoto = async (query, count = 3) => {
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  
  const response = await fetch(
    `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&count=${count}&client_id=${unsplashKey}`
  );
  
  const photos = await response.json();
  
  return photos.map(photo => ({
    url: photo.urls.regular, // Full image URL
    thumb: photo.urls.thumb,
    credit: `${photo.user.name} via Unsplash`,
    downloadUrl: photo.links.download // Link to download full res
  }));
};

// Usage: getUnsplashPhoto("bend oregon mountains", 5)
```

**Expected Latency:** 1-2 seconds

**Docs:** [Unsplash API](https://unsplash.com/developers)

---

## 15. Upstash Redis: Rate-Limit Safe Queue

**Purpose:** Queue social posts, API calls to avoid rate limits

**Auth:** UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

**Code (Node.js):**

```javascript
const queuePost = async (postData) => {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  const response = await fetch(`${redisUrl}/lpush/social_queue`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${redisToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(postData)
  });
  
  return await response.json();
};

// Dequeue and process
const processQueue = async () => {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  const response = await fetch(`${redisUrl}/rpop/social_queue`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${redisToken}` }
  });
  
  const item = await response.json();
  return item; // Process this
};
```

**Expected Latency:** 100-200ms

---

## Where to Run These

### Option A: Inline in Agent Scripts (One-Off Tasks)

Use when:
- Single post, lead capture, or metric pull
- No need to retry or batch

```javascript
// In agent action handler
const videoId = await publishInstagramReel(videoUrl, caption);
console.log(`Reel posted: ${videoId}`);
```

### Option B: Next.js API Routes (Reusable, Batched)

Create routes under `RyanRealty/app/api/social/` for recurring tasks.

**Example structure:**

```
RyanRealty/app/api/social/
  ├── publish-reel.ts (POST /api/social/publish-reel)
  ├── fetch-insights.ts (GET /api/social/fetch-insights?media_id=...)
  ├── create-lead.ts (POST /api/social/create-lead)
  ├── send-email.ts (POST /api/social/send-email)
  ├── queue-posts.ts (POST /api/social/queue-posts)
  └── _lib/
      ├── instagram.ts (IG API helpers)
      ├── followupboss.ts (FUB API helpers)
      └── metrics.ts (Supabase metrics logging)
```

**Scaffold example: publish-reel.ts**

```typescript
// RyanRealty/app/api/social/publish-reel.ts
import { NextRequest, NextResponse } from "next/server";
import { publishInstagramReel } from "./_lib/instagram";

export async function POST(req: NextRequest) {
  try {
    const { videoUrl, caption } = await req.json();
    
    const reelId = await publishInstagramReel(videoUrl, caption);
    
    return NextResponse.json({ success: true, reelId }, { status: 200 });
  } catch (error) {
    console.error("Reel publish failed:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

**Call from agent:**

```javascript
const publishViaRoute = async (videoUrl, caption) => {
  const response = await fetch("/api/social/publish-reel", {
    method: "POST",
    body: JSON.stringify({ videoUrl, caption })
  });
  
  return await response.json();
};
```

---

## Rate Limiting & Error Handling

**Instagram Graph API:**
- Rate limit: 200 calls/hour
- Use Upstash Redis queue to batch posts
- Retry on 429 with exponential backoff

**Follow Up Boss:**
- Rate limit: 1,000 calls/hour
- Safe for single lead capture

**Synthesia:**
- Queue: 1 video at a time (auto-queues if concurrent)
- Latency: 2-3 minutes per video

**Replicate:**
- No hard rate limit (cost-based)
- Poll every 2-3 seconds (not faster)

---

## Verification Checklist

Before using any API in production:

- [ ] Auth key exists and is valid in .env.local
- [ ] API endpoint is correct for April 2026 (search docs if unsure)
- [ ] Error handling wraps all calls (no unhandled rejections)
- [ ] Secrets are never logged or exposed
- [ ] Rate limits are respected (use queue if needed)
- [ ] Success response is validated (not just "no error")
- [ ] All artifacts (video IDs, lead IDs, metrics) are logged to Supabase or Drive

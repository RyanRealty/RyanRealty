# Why the audit isn’t “constant” and why videos might not work

**You asked:** Why isn’t the AI constantly going through the site and fixing things? Why do I have to repeat instructions? Why don’t videos work? Do I need to refresh something?

---

## 1. Why the audit doesn’t run “constantly”

**Cursor doesn’t run in the background.** Rules (including the “continuous UI audit loop”) only run **when you’re in a chat** and the agent is responding. There is no 24/7 process that keeps re-auditing the site.

So:

- **“Constantly”** = the rule says: *when* the agent is working on the project, it should run the full audit loop and **repeat until goals are met** instead of stopping after one pass.
- **To get an audit run:** Start a conversation and say something like:  
  **“Run the full UI audit from GOALS_AND_UI_AUDIT.md and fix everything that fails.”**  
  The agent will then work through the checklist and fix issues in that conversation.
- **No refresh needed** for rules. Each new chat already loads your `.cursor/rules`. If it feels like the agent “forgot,” it’s usually because a new chat doesn’t have the prior conversation context, so you may need to say “run the audit” again in that chat.

**Practical tip:** In any new chat where you care about quality, say: **“Run the UI audit from GOALS_AND_UI_AUDIT.md and fix anything that fails.”** That triggers the loop in that session.

---

## 2. Why videos might not work

### Hero videos (city/search page flyover)

- **Source:** `app/actions/hero-videos.ts` + `lib/grok-video.ts`.  
  Video is **generated** by the xAI (Grok) API, then stored in Supabase (`hero_videos` table + `banners` bucket).
- **Why you might see no video:**
  1. **`XAI_API_KEY` not set** in `.env.local` — generation will fail with a clear error.
  2. **No video has been generated yet** — the hero only shows a video if a row exists in `hero_videos` for that city. Someone (you or an admin) must click “Generate” (or call the generate action) for at least one city.
  3. **Generation failed or timed out** — e.g. API error, rate limit, or timeout; check server logs or the error returned by the generate action.
- **Home page:** The home page hero uses a **banner image** (from `getOrCreatePlaceBanner`), not the hero video. City/search pages (e.g. `/search/bend`) use the hero video **if** one exists for that city.

### Listing videos (listing detail page)

- Listing hero and “Videos & virtual tours” use: ObjectHtml, direct .mp4 URLs, YouTube/Vimeo embeds.  
- If those don’t play: check that the listing has the correct URL fields and that `docs/VIDEO_DATA_FLOW.md` is followed; CORS or invalid URLs can prevent playback.

---

## 3. What to do next

1. **Run an audit in this session:** Say: **“Run the full UI audit from GOALS_AND_UI_AUDIT.md and fix everything.”**
2. **Hero videos:** Add `XAI_API_KEY` to `.env.local` if you want generation. Then open a city/search page (e.g. `/search/bend`) and use the “Generate” hero video action so a video is created and stored.
3. **Homepage:** If it still “looks like buns,” say what feels off (e.g. “hero too plain,” “sections too cramped,” “footer looks cheap”) and the agent can target those with the design system and `HOME_PAGE_BEST_PRACTICES.md`.

No special “refresh” is required for rules; starting a new chat and asking for the audit is enough.

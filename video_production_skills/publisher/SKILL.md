---
name: publisher
description: >
  Alias route for multi-platform video publishing. The full procedure, platform
  matrix, env prerequisites, and research doc links live in the automation publish
  skill. Load this file to get the pointer; then open the canonical skill below.
---

# Publisher — multi-platform video delivery

## Canonical references

This is a capability skill. The two top-tier rule layers — [`design_system/ryan-realty/SKILL.md`](../../design_system/ryan-realty/SKILL.md) (brand) and [`social_media_skills/platform-best-practices/SKILL.md`](../../social_media_skills/platform-best-practices/SKILL.md) (platform rules) — apply to all output. Per CLAUDE.md "Skill self-binding", every Ryan Realty content piece loads both before producing.

---

**Canonical skill (read this in full):** [`automation_skills/automation/publish/SKILL.md`](../../automation_skills/automation/publish/SKILL.md)

That file defines:

- Hard preconditions (`gate.json`, `humanApprovedAt`, Matt approval, `/api/social/publish` payload)
- Per-platform matrix (IG, FB, TikTok, YouTube, LinkedIn, X, Pinterest, Threads, Nextdoor, GBP)
- Buffer vs native API decision
- Failure handling and reference docs under `docs/research/`

**Blog / AgentFire WordPress** (long-form articles, oEmbed YouTube, JSON-LD):  
[`social_media_skills/blog-post/SKILL.md`](../../social_media_skills/blog-post/SKILL.md) — includes `WP_AGENTFIRE_USER`, `WP_AGENTFIRE_APP_PASSWORD`, and REST paths.

**Pipeline context:** [`video_production_skills/content_pipeline/SKILL.md`](../content_pipeline/SKILL.md) (publish stage env table; high-level only).

**Queue / Buffer alternatives:**  
[`automation_skills/automation/post_scheduler/SKILL.md`](../../automation_skills/automation/post_scheduler/SKILL.md),  
[`automation_skills/automation/buffer_poster/SKILL.md`](../../automation_skills/automation/buffer_poster/SKILL.md).

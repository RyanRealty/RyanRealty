/**
 * marketing-brain: inbox-producer-registry
 *
 * Static action_type → assigned_producer lookup. Mirrors
 * marketing_brain_skills/producers/REGISTRY.md (Sections A–F). The brain
 * itself reads the markdown registry at decision-time; this TS shim
 * exists so the inbox dispatcher can resolve a producer path in-process
 * without parsing the markdown.
 *
 * INVARIANT (enforced by scripts/check-producer-registry-resolves.mjs,
 * ci:producer-registry-resolves): every path here must resolve to a real
 * `<path>/SKILL.md` in the DEPLOYED repo — i.e. a producer the cloud
 * producer-runtime can actually load. A producer whose SKILL.md is NOT in the
 * repo (the decommissioned video producers, whose `video_production_skills/`
 * tree lives only on the local render worker — see REGISTRY.md "VIDEO PRODUCERS
 * DECOMMISSIONED 2026-06-14") must NOT appear here: with no entry, the dispatcher
 * falls through to comms:matt_alert (resolveProducer → null in inbox-dispatcher),
 * which is exactly the intended funnel — the broker's video request reaches Matt,
 * who fulfills it on the local worker. Mapping it to a non-existent path instead
 * makes producer-runtime die with "SKILL.md not found" and the request is lost.
 *
 * Drift detection: if the parser emits an action_type that is not a key in this
 * map, the dispatcher routes the inbox event to comms:matt_alert with a "no
 * producer registered" reason. So the video content:* action_types (still valid
 * in inbox-parser's VALID_ACTION_TYPES, so Matt's alert names the deliverable)
 * correctly land at matt_alert for local fulfillment.
 */

const PRODUCER_REGISTRY: Record<string, string> = {
  // Section A — orchestrators (cloud-runnable only)
  'content:list_kit': 'social_media_skills/list-kit',

  // Section B — content producers (flat-design / text; video producers
  // decommissioned 2026-06-14 → routed to matt_alert by omission)
  'content:blog_post': 'social_media_skills/blog-post',
  'content:seo_blog': 'social_media_skills/blog-post',
  'content:fb_lead_gen_ad': 'social_media_skills/facebook-lead-gen-ad',
  'content:fb_ad': 'social_media_skills/facebook-lead-gen-ad',
  'content:flyer': 'social_media_skills/flyer-design',
  'content:just_listed_flyer': 'social_media_skills/flyer-design',
  'content:open_house_flyer': 'social_media_skills/flyer-design',
  'content:feature_sheet': 'social_media_skills/flyer-design',
  'content:ig_carousel': 'social_media_skills/instagram-carousel',
  'content:image_meme': 'social_media_skills/meme_lord',
  'content:ig_single_post': 'social_media_skills/ig-single-post',
  'content:open_house_stories': 'social_media_skills/open-house-stories',
  'content:under_contract_announcement': 'social_media_skills/under-contract-announcement',
  'content:sold_deal_summary': 'social_media_skills/sold-deal-summary',
  'content:linkedin_doc_carousel': 'social_media_skills/linkedin-document-carousel',
  'content:agent_coop_eflyer': 'social_media_skills/agent-coop-eflyer',
  'content:postcard_mailer': 'social_media_skills/postcard-farm-mailer',
  'content:yard_sign': 'social_media_skills/yard-sign-rider',
  'content:neighbor_note': 'social_media_skills/neighbor-outreach-note',

  // Section C — site producers
  'site:copy_update': 'marketing_brain_skills/producers/site-edit',
  'site:meta_update': 'marketing_brain_skills/producers/site-edit',
  'site:cta_update': 'marketing_brain_skills/producers/site-edit',
  'site:page_create': 'marketing_brain_skills/producers/site-page-create',
  'site:landing_page_create': 'marketing_brain_skills/producers/site-page-create',
  'site:perf_fix': 'marketing_brain_skills/producers/site-performance',
  'site:redirect_add': 'marketing_brain_skills/producers/site-performance',
  'site:schema_add': 'marketing_brain_skills/producers/site-performance',
  'site:property_landing_create': 'marketing_brain_skills/producers/site-property-landing',
  'site:property_landing_update': 'marketing_brain_skills/producers/site-property-landing',
  'site:matterport_embed': 'marketing_brain_skills/producers/site-matterport-embed',

  // Section D — operational producers
  'ops:meta_budget': 'marketing_brain_skills/producers/ops-meta-ads',
  'ops:meta_pause': 'marketing_brain_skills/producers/ops-meta-ads',
  'ops:meta_resume': 'marketing_brain_skills/producers/ops-meta-ads',
  'ops:meta_audience': 'marketing_brain_skills/producers/ops-meta-ads',
  'ops:meta_creative_swap': 'marketing_brain_skills/producers/ops-meta-ads',
  'ops:email_newsletter': 'marketing_brain_skills/producers/ops-email-send',
  'ops:email_blast': 'marketing_brain_skills/producers/ops-email-send',
  'ops:email_template_update': 'marketing_brain_skills/producers/ops-email-send',
  'ops:review_response': 'marketing_brain_skills/producers/ops-reputation',
  'ops:review_request': 'marketing_brain_skills/producers/ops-reputation',
  'ops:gbp_post': 'marketing_brain_skills/producers/ops-reputation',
  'ops:gbp_qna': 'marketing_brain_skills/producers/ops-reputation',
  'ops:fb_marketplace_create': 'marketing_brain_skills/producers/ops-fb-marketplace',
  'ops:fb_marketplace_update': 'marketing_brain_skills/producers/ops-fb-marketplace',
  'ops:manychat_setup': 'marketing_brain_skills/producers/ops-manychat',
  'ops:manychat_pause': 'marketing_brain_skills/producers/ops-manychat',
  'ops:manychat_update': 'marketing_brain_skills/producers/ops-manychat',

  // Section E — communications
  'comms:matt_alert': 'marketing_brain_skills/producers/comms-matt-alert',
  'comms:matt_summary': 'marketing_brain_skills/producers/comms-matt-alert',
  'comms:team_update': 'marketing_brain_skills/producers/comms-matt-alert',
  'comms:stakeholder_summary': 'marketing_brain_skills/producers/comms-matt-alert',

  // Section F — analysis
  'analyze:drop_investigation': 'marketing_brain_skills/analyze-anomaly',
  'analyze:spike_investigation': 'marketing_brain_skills/analyze-anomaly',
  'analyze:metric_decomposition': 'marketing_brain_skills/analyze-anomaly',
  'analyze:ab_test_design': 'marketing_brain_skills/analyze-experiment',
  'analyze:ab_test_readout': 'marketing_brain_skills/analyze-experiment',
}

export default PRODUCER_REGISTRY

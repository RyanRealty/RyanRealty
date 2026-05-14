/**
 * marketing-brain: inbox-producer-registry
 *
 * Static action_type → assigned_producer lookup. Mirrors
 * marketing_brain_skills/producers/REGISTRY.md (Sections A–F). The brain
 * itself reads the markdown registry at decision-time; this TS shim
 * exists so the inbox dispatcher can resolve a producer path in-process
 * without parsing the markdown.
 *
 * Sync 2026-05-14. When a producer is added to REGISTRY.md, add a row
 * here too. Drift detection: if the parser emits an action_type that
 * is not a key in this map, the dispatcher routes the inbox event to
 * comms:matt_alert with a "no producer registered" reason.
 */

const PRODUCER_REGISTRY: Record<string, string> = {
  // Section A — orchestrators
  'content:list_kit': 'social_media_skills/list-kit',
  'content:monthly_market_report': 'video_production_skills/monthly-market-report-orchestrator',
  'content:listing_launch': 'video_production_skills/listing_launch',

  // Section B — content producers
  'content:listing_video': 'video_production_skills/listing-tour-video',
  'content:listing_reel': 'video_production_skills/listing_reveal',
  'content:market_video': 'video_production_skills/market-data-video',
  'content:market_data_short': 'video_production_skills/market-data-video',
  'content:market_youtube_longform': 'video_production_skills/youtube-long-form-market-report',
  'content:news_clip': 'video_production_skills/news-video',
  'content:news_video': 'video_production_skills/news-video',
  'content:neighborhood_tour': 'video_production_skills/neighborhood_tour',
  'content:area_guide_long': 'video_production_skills/neighborhood_tour',
  'content:area_guide_short': 'video_production_skills/area_guides',
  'content:neighborhood_reel': 'video_production_skills/area_guides',
  'content:market_data_viz': 'video_production_skills/data_viz_video',
  'content:stats_clip': 'video_production_skills/data_viz_video',
  'content:avatar_market_update': 'video_production_skills/avatar_market_update',
  'content:meme_video': 'video_production_skills/meme_content',
  'content:earth_zoom': 'video_production_skills/earth_zoom',
  'content:aerial_flyover': 'video_production_skills/google_maps_flyover',
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
  'content:market_stat_card_video': 'video_production_skills/market_report_video',
  'content:avatar_video': 'video_production_skills/news_video',
  'content:social_calendar': 'video_production_skills/social_calendar',
  'content:ig_single_post': 'social_media_skills/ig-single-post',
  'content:coming_soon_teaser': 'social_media_skills/coming-soon-teaser',
  'content:tiktok_listing_tour': 'video_production_skills/tiktok-listing-tour',
  'content:yt_longform_walkthrough': 'video_production_skills/youtube-long-form-walkthrough',
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
  'ops:fub_tag_fix': 'marketing_brain_skills/producers/ops-fub-crm',
  'ops:fub_sequence_change': 'marketing_brain_skills/producers/ops-fub-crm',
  'ops:fub_task_create': 'marketing_brain_skills/producers/ops-fub-crm',
  'ops:fub_routing': 'marketing_brain_skills/producers/ops-fub-crm',
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

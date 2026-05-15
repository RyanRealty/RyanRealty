/**
 * Broker-facing catalog of deliverables we can build.
 *
 * Each item maps to one or more action_types in the producer registry but is
 * worded for brokers, not for the brain. Edit this file (not the registry)
 * when the menu changes — the inbox parser handles the mapping internally.
 *
 * `prompts` are the lines appended to the email body when the broker checks
 * the item. They start with a present-tense verb so the parser reads them as
 * direct asks.
 *
 * `needsProperty` items unhide the "property address or MLS#" field.
 * `needsMarket` items unhide the "city or neighborhood" field.
 * `needsTopic` items unhide the "topic" field.
 */

export interface Deliverable {
  id: string
  label: string
  description: string
  prompt: string
  needsProperty?: boolean
  needsMarket?: boolean
  needsTopic?: boolean
}

export interface DeliverableGroup {
  title: string
  blurb: string
  items: Deliverable[]
}

export const DELIVERABLE_GROUPS: DeliverableGroup[] = [
  {
    title: 'For a listing',
    blurb: 'Everything that markets one specific home.',
    items: [
      {
        id: 'listing_reel',
        label: 'Listing reel',
        description: '40-second vertical video. Built for Instagram, TikTok, Facebook Reels.',
        prompt: 'Make a listing reel.',
        needsProperty: true,
      },
      {
        id: 'listing_tour_video',
        label: 'Listing tour video',
        description: '60–90 seconds. Drone exterior + interior walkthrough.',
        prompt: 'Make a full listing tour video.',
        needsProperty: true,
      },
      {
        id: 'list_kit',
        label: 'Full listing kit',
        description: 'Everything at once: reel + flyer + carousel + single post + tour video. One ask, full launch.',
        prompt: 'Build the full listing kit.',
        needsProperty: true,
      },
      {
        id: 'just_listed_flyer',
        label: 'Just-listed flyer',
        description: 'Print-ready 8.5×11 flyer for open houses, MLS uploads, and email blasts.',
        prompt: 'Make a just-listed flyer.',
        needsProperty: true,
      },
      {
        id: 'open_house_flyer',
        label: 'Open house flyer',
        description: 'Open house version with date/time/QR code.',
        prompt: 'Make an open house flyer (please include the date and time below).',
        needsProperty: true,
      },
      {
        id: 'feature_sheet',
        label: 'Property feature sheet',
        description: 'Full marketing one-pager with photos, features, and contact info.',
        prompt: 'Make a property feature sheet.',
        needsProperty: true,
      },
      {
        id: 'ig_carousel',
        label: 'Instagram carousel',
        description: '8–10 slide carousel for IG/Facebook. Photo grid plus key facts.',
        prompt: 'Make an Instagram carousel.',
        needsProperty: true,
      },
      {
        id: 'ig_single_post',
        label: 'Single Instagram post',
        description: 'One-image post: Just Listed, Open House, Coming Soon, Price Improvement, or Sold.',
        prompt: 'Make a single Instagram post (let us know which variant: Just Listed / Open House / Coming Soon / Price Improvement / Sold).',
        needsProperty: true,
      },
      {
        id: 'coming_soon_teaser',
        label: 'Coming-soon teaser',
        description: 'Pre-Active reel + IG/FB Stories. Exterior-only, 10–15s.',
        prompt: 'Make a coming-soon teaser.',
        needsProperty: true,
      },
      {
        id: 'under_contract_announcement',
        label: 'Under-contract announcement',
        description: '4:5 static post with the close details. No fluff.',
        prompt: 'Make an under-contract announcement.',
        needsProperty: true,
      },
      {
        id: 'sold_deal_summary',
        label: 'Just sold / sold deal summary',
        description: 'IG/FB static + LinkedIn market-insight version.',
        prompt: 'Make a sold deal summary.',
        needsProperty: true,
      },
      {
        id: 'postcard_mailer',
        label: 'Postcard mailer',
        description: 'USPS direct mail to 0.5-mile farm radius around the listing.',
        prompt: 'Make a postcard mailer (just-listed or just-sold version).',
        needsProperty: true,
      },
      {
        id: 'yard_sign',
        label: 'Yard sign / rider',
        description: '18×24 sign + rider variants (just-listed, open house, under contract, sold).',
        prompt: 'Make a yard sign or rider.',
        needsProperty: true,
      },
      {
        id: 'neighbor_note',
        label: 'Neighbor outreach note',
        description: 'Handwritten-style card text + Avery labels for the 20–40 closest neighbors.',
        prompt: 'Make a neighbor outreach note + label sheet.',
        needsProperty: true,
      },
      {
        id: 'agent_coop_eflyer',
        label: 'Agent-to-agent eflyer',
        description: 'Email blast template for the cooperating-agent network.',
        prompt: 'Make an agent-to-agent eflyer.',
        needsProperty: true,
      },
    ],
  },
  {
    title: 'Market reports',
    blurb: 'Quarterly, monthly, and one-off market education.',
    items: [
      {
        id: 'monthly_market_report',
        label: 'Monthly market report (the full set)',
        description: 'Video + blog post + carousel + flyer + single post. One ask gets you the whole package.',
        prompt: 'Run the monthly market report.',
        needsMarket: true,
      },
      {
        id: 'market_data_short',
        label: 'Short market video',
        description: '30–45 second vertical for IG/TikTok/Reels.',
        prompt: 'Make a short market video.',
        needsMarket: true,
      },
      {
        id: 'market_youtube_longform',
        label: 'YouTube market report',
        description: '8–12 minutes, 1920×1080, deep market read for the channel.',
        prompt: 'Make a long-form YouTube market report.',
        needsMarket: true,
      },
      {
        id: 'market_data_viz',
        label: 'Market data carousel',
        description: 'Charts + stats in an IG/FB carousel.',
        prompt: 'Make a market data carousel.',
        needsMarket: true,
      },
      {
        id: 'blog_post',
        label: 'Blog post',
        description: 'SEO blog post on the topic. Posts to ryan-realty.com.',
        prompt: 'Write a blog post.',
        needsTopic: true,
      },
    ],
  },
  {
    title: 'Neighborhoods',
    blurb: 'Anything area-specific that is not a market report.',
    items: [
      {
        id: 'neighborhood_tour',
        label: 'Neighborhood tour video',
        description: 'Mid-length feature on a Bend / Redmond / Sisters / Sunriver area.',
        prompt: 'Make a neighborhood tour video.',
        needsMarket: true,
      },
      {
        id: 'area_guide_short',
        label: 'Short area guide',
        description: '30–45 second vertical highlighting one neighborhood.',
        prompt: 'Make a short area guide reel.',
        needsMarket: true,
      },
    ],
  },
  {
    title: 'News, evergreen, and social',
    blurb: 'One-off posts. Not tied to a property or a market window.',
    items: [
      {
        id: 'news_clip',
        label: 'Real estate news clip',
        description: '30–45 second vertical reacting to a real estate news story.',
        prompt: 'Make a real estate news clip.',
        needsTopic: true,
      },
      {
        id: 'meme_video',
        label: 'Meme video',
        description: 'Short comedic clip. Builds reach without selling.',
        prompt: 'Make a meme video.',
        needsTopic: true,
      },
      {
        id: 'image_meme',
        label: 'Image meme',
        description: 'Static meme post. Lower lift than a video.',
        prompt: 'Make an image meme.',
        needsTopic: true,
      },
    ],
  },
  {
    title: 'Email, ads, and reviews',
    blurb: 'Operational stuff that lives outside of social.',
    items: [
      {
        id: 'email_newsletter',
        label: 'Email newsletter',
        description: 'Drafted newsletter sent to your email segment in FUB.',
        prompt: 'Draft an email newsletter (let us know which segment below).',
      },
      {
        id: 'fb_lead_gen_ad',
        label: 'Facebook lead-gen ad',
        description: 'New creative + form for the seller-lead funnel.',
        prompt: 'Make a Facebook lead-gen ad creative.',
        needsTopic: true,
      },
      {
        id: 'gbp_post',
        label: 'Google Business Profile post',
        description: 'Local SEO + Map-Pack visibility post.',
        prompt: 'Make a Google Business Profile post.',
        needsTopic: true,
      },
      {
        id: 'review_request',
        label: 'Client review request',
        description: 'Templated outreach asking a past client for a Google review.',
        prompt: 'Draft a client review request.',
      },
    ],
  },
  {
    title: 'Website',
    blurb: 'Changes to ryan-realty.com.',
    items: [
      {
        id: 'site_copy_update',
        label: 'Update existing page copy',
        description: 'Edit hero text, sections, or CTAs on a live page.',
        prompt: 'Update copy on the website (please name the page below).',
      },
      {
        id: 'site_landing_page_create',
        label: 'New landing page',
        description: 'Brand-new page (lead-capture, campaign, evergreen).',
        prompt: 'Build a new landing page (let us know the purpose and the URL slug you want).',
      },
      {
        id: 'site_property_landing_create',
        label: 'Per-listing landing page',
        description: 'Dedicated page for one listing — gallery, video, 3D tour, showing form.',
        prompt: 'Build a per-listing landing page.',
        needsProperty: true,
      },
    ],
  },
]

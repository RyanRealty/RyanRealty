export type LeadLandingAudience = 'seller' | 'buyer'

export type LeadLandingConfig = {
  intent: string
  audience: LeadLandingAudience
  path: string
  title: string
  subtitle: string
  seoTitle: string
  seoDescription: string
  heroImageUrl: string
  imageAlt: string
  primaryCtaLabel: string
  secondaryCtaLabel: string
  secondaryCtaHref: string
  trustBullets: string[]
  challengeTitle: string
  challengeBullets: string[]
  processTitle: string
  processSteps: string[]
  faq: Array<{ question: string; answer: string }>
  formTitle: string
  formSubtitle: string
}

export const SELL_INTENT_PAGES: Record<string, LeadLandingConfig> = {
  'for-sale-by-owner': {
    intent: 'for-sale-by-owner',
    audience: 'seller',
    path: '/sell/for-sale-by-owner',
    title: 'Thinking about selling your home on your own',
    subtitle: 'Get a strategy review before you list. We show you what usually costs FSBO sellers the most money and how to avoid it.',
    seoTitle: 'FSBO Help in Central Oregon | Ryan Realty',
    seoDescription: 'Considering for sale by owner in Central Oregon. Get a data driven pricing and marketing review before you list your home.',
    heroImageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=2200&q=80',
    imageAlt: 'Home for sale sign in front of a house',
    primaryCtaLabel: 'Get my FSBO strategy review',
    secondaryCtaLabel: 'See active listings',
    secondaryCtaHref: '/homes-for-sale',
    trustBullets: [
      'No pressure consultation',
      'Pricing and offer strategy backed by local data',
      'Showings negotiation and paperwork guidance',
    ],
    challengeTitle: 'Common FSBO pressure points',
    challengeBullets: [
      'Pricing too high can stall interest while pricing too low leaves money on the table',
      'Buyer screening and offer terms can become a full time job',
      'Inspection repair and appraisal issues can break otherwise strong deals',
    ],
    processTitle: 'How we help FSBO sellers',
    processSteps: [
      'Review your goals and timeline in a short call',
      'Share a local pricing and offer strategy',
      'Map the exact marketing and negotiation plan',
    ],
    faq: [
      {
        question: 'Can I still try FSBO first',
        answer: 'Yes. Many owners start with a strategy review and decide after seeing pricing risk and marketing workload.',
      },
      {
        question: 'Do you provide pricing guidance without a listing agreement',
        answer: 'Yes. We can provide a no pressure pricing review so you can make a clear decision.',
      },
    ],
    formTitle: 'Request your FSBO strategy call',
    formSubtitle: 'Tell us where you are in the process and we will send a practical plan.',
  },
  'expired-listings': {
    intent: 'expired-listings',
    audience: 'seller',
    path: '/sell/expired-listings',
    title: 'If your listing expired we can relaunch it with a better plan',
    subtitle: 'Most expired listings do not fail because the home is bad. They fail because pricing positioning and exposure miss the buyer pool.',
    seoTitle: 'Expired Listing Help in Central Oregon | Ryan Realty',
    seoDescription: 'Relist your expired home with a stronger pricing and marketing strategy built for Central Oregon buyers.',
    heroImageUrl: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=2200&q=80',
    imageAlt: 'Residential home exterior in evening light',
    primaryCtaLabel: 'Get my relaunch plan',
    secondaryCtaLabel: 'Request a valuation',
    secondaryCtaHref: '/sell/valuation',
    trustBullets: [
      'Fast review of prior listing performance',
      'Clear recommendations you can act on immediately',
      'Relaunch timeline built around buyer demand windows',
    ],
    challengeTitle: 'Why expired listings usually stall',
    challengeBullets: [
      'Initial list price missed current buyer demand',
      'Photos copy or positioning did not match what buyers were searching for',
      'Offer follow up and negotiation structure lacked urgency',
    ],
    processTitle: 'Our expired listing relaunch process',
    processSteps: [
      'Audit the old listing and showings feedback',
      'Reset price and presentation strategy',
      'Relaunch with stronger exposure and follow up',
    ],
    faq: [
      {
        question: 'How quickly can we relist',
        answer: 'In many cases we can relaunch within days after finalizing pricing prep and media.',
      },
      {
        question: 'Can we fix this without major renovations',
        answer: 'Usually yes. We prioritize the few changes that move buyer perception fastest.',
      },
    ],
    formTitle: 'Request your expired listing relaunch review',
    formSubtitle: 'Share the property and we will send a practical relaunch path.',
  },
  'inherited-home': {
    intent: 'inherited-home',
    audience: 'seller',
    path: '/sell/inherited-home',
    title: 'Selling an inherited home without added stress',
    subtitle: 'We help families sort pricing prep timelines and local buyer demand so decisions feel clear.',
    seoTitle: 'Sell an Inherited Home in Central Oregon | Ryan Realty',
    seoDescription: 'Practical support for inherited home sales including pricing prep timeline and buyer strategy in Central Oregon.',
    heroImageUrl: 'https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=2200&q=80',
    imageAlt: 'Warm residential home exterior at sunset',
    primaryCtaLabel: 'Get inherited home guidance',
    secondaryCtaLabel: 'Contact our team',
    secondaryCtaHref: '/contact?inquiry=Selling',
    trustBullets: [
      'Clear next steps from day one',
      'Practical prep recommendations based on return and timing',
      'Communication paced to your family timeline',
    ],
    challengeTitle: 'Inherited sale decisions that need clarity',
    challengeBullets: [
      'Sell as is versus make targeted updates',
      'How to set pricing with changing market conditions',
      'How quickly to list based on your goals and costs',
    ],
    processTitle: 'How we support inherited home sellers',
    processSteps: [
      'Review condition and market value range',
      'Build a prep and pricing roadmap',
      'Launch with a buyer focused marketing plan',
    ],
    faq: [
      {
        question: 'Can we sell as is',
        answer: 'Yes. We can compare as is pricing to updated pricing so you can choose based on net outcome and timeline.',
      },
      {
        question: 'How long does it usually take',
        answer: 'That depends on condition and pricing, but we provide a realistic timeline before launch.',
      },
    ],
    formTitle: 'Request inherited home sale guidance',
    formSubtitle: 'Tell us your timeline and we will outline practical next steps.',
  },
}

export const BUY_INTENT_PAGES: Record<string, LeadLandingConfig> = {
  'first-time-home-buyer': {
    intent: 'first-time-home-buyer',
    audience: 'buyer',
    path: '/buy/first-time-home-buyer',
    title: 'First time buyer guidance for Central Oregon',
    subtitle: 'Understand budget financing and offer strategy before you tour so you can buy with confidence.',
    seoTitle: 'First Time Home Buyer Help in Central Oregon | Ryan Realty',
    seoDescription: 'Guidance for first time buyers in Central Oregon including budget planning neighborhoods and offer strategy.',
    heroImageUrl: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=2200&q=80',
    imageAlt: 'Modern home with mountain backdrop in evening light',
    primaryCtaLabel: 'Get my first time buyer plan',
    secondaryCtaLabel: 'Browse homes for sale',
    secondaryCtaHref: '/homes-for-sale',
    trustBullets: [
      'Step by step process with plain language',
      'Local neighborhood guidance based on your lifestyle',
      'Offer and negotiation support from search to close',
    ],
    challengeTitle: 'What first time buyers usually need help with',
    challengeBullets: [
      'Understanding full monthly cost not just list price',
      'Picking neighborhoods that fit your daily life',
      'Writing competitive offers without overpaying',
    ],
    processTitle: 'How we guide first time buyers',
    processSteps: [
      'Set budget and search criteria',
      'Tour homes and compare tradeoffs',
      'Write and negotiate a confident offer',
    ],
    faq: [
      {
        question: 'How much cash do I need to buy',
        answer: 'It varies by loan type and home price. We help you map expected cash to close before you start touring.',
      },
      {
        question: 'Can I buy while rates are higher',
        answer: 'Yes. We focus on payment comfort and long term fit so you can decide with confidence.',
      },
    ],
    formTitle: 'Request your first time buyer plan',
    formSubtitle: 'Tell us your price range and timeline and we will map your next steps.',
  },
  relocation: {
    intent: 'relocation',
    audience: 'buyer',
    path: '/buy/relocation',
    title: 'Relocating to Central Oregon with confidence',
    subtitle: 'Get local insight on neighborhoods commute schools and inventory so your move feels organized and low stress.',
    seoTitle: 'Relocation Real Estate Help in Central Oregon | Ryan Realty',
    seoDescription: 'Planning a move to Central Oregon. Get practical relocation support and neighborhood guidance from local experts.',
    heroImageUrl: 'https://images.unsplash.com/photo-1530538987395-032d1800fdd4?auto=format&fit=crop&w=2200&q=80',
    imageAlt: 'Mountain town neighborhood at golden hour',
    primaryCtaLabel: 'Get my relocation plan',
    secondaryCtaLabel: 'Explore area guides',
    secondaryCtaHref: '/area-guides',
    trustBullets: [
      'Neighborhood matches based on your priorities',
      'Virtual and in person touring support',
      'Move timeline coordination through closing',
    ],
    challengeTitle: 'Relocation friction points we solve',
    challengeBullets: [
      'Narrowing cities and neighborhoods quickly',
      'Touring efficiently when you are out of area',
      'Aligning offer timing with move dates and financing',
    ],
    processTitle: 'How our relocation support works',
    processSteps: [
      'Define lifestyle and commute priorities',
      'Build a focused neighborhood shortlist',
      'Tour and secure the right home on your timeline',
    ],
    faq: [
      {
        question: 'Can we start remotely',
        answer: 'Yes. We support virtual planning tours and offer prep before you travel.',
      },
      {
        question: 'Which cities should we consider first',
        answer: 'That depends on budget lifestyle and commute. We help narrow options quickly with local context.',
      },
    ],
    formTitle: 'Request your relocation consultation',
    formSubtitle: 'Share your move timeline and priorities and we will send a focused plan.',
  },
  investment: {
    intent: 'investment',
    audience: 'buyer',
    path: '/buy/investment',
    title: 'Investment property strategy in Central Oregon',
    subtitle: 'We help investors evaluate price rent demand and resale positioning so acquisitions are disciplined and data driven.',
    seoTitle: 'Central Oregon Investment Property Guidance | Ryan Realty',
    seoDescription: 'Looking for an investment property in Central Oregon. Get data driven acquisition guidance from Ryan Realty.',
    heroImageUrl: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=2200&q=80',
    imageAlt: 'Modern home exterior and neighborhood street view',
    primaryCtaLabel: 'Get my investment strategy call',
    secondaryCtaLabel: 'View market reports',
    secondaryCtaHref: '/reports/explore',
    trustBullets: [
      'Data first buy box planning',
      'Neighborhood and inventory intelligence',
      'Clear underwriting assumptions before offers',
    ],
    challengeTitle: 'Investment questions we help answer',
    challengeBullets: [
      'Which neighborhoods have durable demand',
      'How to balance cash flow potential and appreciation',
      'How to structure offers in competitive submarkets',
    ],
    processTitle: 'How we support investors',
    processSteps: [
      'Define buy box and risk profile',
      'Source and analyze candidate inventory',
      'Negotiate and close with a clear thesis',
    ],
    faq: [
      {
        question: 'Do you work with out of state investors',
        answer: 'Yes. We support remote planning and local execution throughout acquisition.',
      },
      {
        question: 'Can you help with portfolio expansion',
        answer: 'Yes. We can map staged acquisition plans by budget and target returns.',
      },
    ],
    formTitle: 'Request investment property guidance',
    formSubtitle: 'Share your criteria and we will send a focused acquisition plan.',
  },
}

export function getSellLanding(intent: string): LeadLandingConfig | null {
  return SELL_INTENT_PAGES[intent] ?? null
}

export function getBuyLanding(intent: string): LeadLandingConfig | null {
  return BUY_INTENT_PAGES[intent] ?? null
}

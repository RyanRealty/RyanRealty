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
    // Layer A H1 / SEO — do not poetry-rewrite
    title: 'Thinking about selling your home on your own',
    subtitle:
      'Before you list, we show what usually costs FSBO sellers money: price, buyer screening, and the repair and appraisal fights that kill deals.',
    seoTitle: 'FSBO Help in Central Oregon | Ryan Realty',
    seoDescription: 'Considering for sale by owner in Central Oregon. Get a data driven pricing and marketing review before you list your home.',
    heroImageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=2200&q=80',
    imageAlt: 'Home for sale sign in front of a house',
    primaryCtaLabel: 'Get my FSBO strategy review',
    secondaryCtaLabel: 'See active listings',
    secondaryCtaHref: '/homes-for-sale',
    trustBullets: [
      'A short call, no listing agreement required',
      'Pricing and offer terms from local closed sales',
      'Showings, negotiation, and paperwork laid out plainly',
    ],
    challengeTitle: 'Where FSBO sellers lose money',
    challengeBullets: [
      'List price too high stalls interest; list price too low leaves cash on the table',
      'Screening buyers and reading offer terms becomes a second job',
      'Inspection repairs and appraisal gaps break deals that looked solid',
    ],
    processTitle: 'How we help if you are selling yourself',
    processSteps: [
      'Review your goals and timeline on a short call',
      'Walk the local comps and a realistic offer range',
      'Map marketing, showings, and negotiation if you still want to go alone, or list with us',
    ],
    faq: [
      {
        question: 'Can I still try FSBO first',
        answer: 'Yes. Many owners start with a pricing review, then decide after they see the workload and the risk of missing the market.',
      },
      {
        question: 'Do you provide pricing guidance without a listing agreement',
        answer: 'Yes. We can run a pricing review with no contract. You decide after you see the numbers.',
      },
    ],
    formTitle: 'Request your FSBO strategy call',
    formSubtitle: 'Tell us where you are in the process. We will send a practical plan.',
  },
  'expired-listings': {
    intent: 'expired-listings',
    audience: 'seller',
    path: '/sell/expired-listings',
    title: 'If your listing expired we can relaunch it with a better plan',
    subtitle:
      'Most expired listings fail on price, photos, or exposure, not because the house is wrong. We fix those three before you go live again.',
    seoTitle: 'Expired Listing Help in Central Oregon | Ryan Realty',
    seoDescription: 'Relist your expired home with a stronger pricing and marketing strategy built for Central Oregon buyers.',
    heroImageUrl: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=2200&q=80',
    imageAlt: 'Residential home exterior in evening light',
    primaryCtaLabel: 'Get my relaunch plan',
    secondaryCtaLabel: 'Request a valuation',
    secondaryCtaHref: '/sell/valuation',
    trustBullets: [
      'Review of what the last listing did and did not do',
      'Concrete changes you can make this week',
      'A relaunch timeline matched to current buyer traffic',
    ],
    challengeTitle: 'Why expired listings stall',
    challengeBullets: [
      'The first list price missed what buyers would pay',
      'Photos, copy, or positioning did not match how buyers search',
      'Follow-up and negotiation had no urgency when interest appeared',
    ],
    processTitle: 'How we relaunch an expired listing',
    processSteps: [
      'Audit the old listing and showing feedback',
      'Reset price and presentation',
      'Relaunch with clearer exposure and follow-up',
    ],
    faq: [
      {
        question: 'How quickly can we relist',
        answer: 'Often within days after price, prep, and media are set.',
      },
      {
        question: 'Can we fix this without major renovations',
        answer: 'Usually yes. We focus on the few changes that move buyer response fastest.',
      },
    ],
    formTitle: 'Request your expired listing relaunch review',
    formSubtitle: 'Share the property. We will send a practical relaunch path.',
  },
  'inherited-home': {
    intent: 'inherited-home',
    audience: 'seller',
    path: '/sell/inherited-home',
    title: 'Selling an inherited home without added stress',
    subtitle:
      'We sort pricing, prep, and timing so the family can decide whether to sell as-is or fix a few things first.',
    seoTitle: 'Sell an Inherited Home in Central Oregon | Ryan Realty',
    seoDescription: 'Practical support for inherited home sales including pricing prep timeline and buyer strategy in Central Oregon.',
    heroImageUrl: 'https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=2200&q=80',
    imageAlt: 'Warm residential home exterior at sunset',
    primaryCtaLabel: 'Get inherited home guidance',
    secondaryCtaLabel: 'Contact our team',
    secondaryCtaHref: '/contact?inquiry=Selling',
    trustBullets: [
      'Next steps named on day one',
      'Prep advice weighed against return and calendar',
      'Communication paced to the family, not our pipeline',
    ],
    challengeTitle: 'Decisions that need a number first',
    challengeBullets: [
      'Sell as-is versus make targeted updates',
      'How to set price against current inventory and closed sales',
      'How fast to list given holding costs and your timeline',
    ],
    processTitle: 'How we support an inherited sale',
    processSteps: [
      'Review condition and a value range from recent comps',
      'Build a prep and pricing plan',
      'List with marketing aimed at the buyers who actually buy these homes',
    ],
    faq: [
      {
        question: 'Can we sell as is',
        answer: 'Yes. We compare as-is pricing to updated pricing so you can choose on net proceeds and time, not on hope.',
      },
      {
        question: 'How long does it usually take',
        answer: 'It depends on condition and price. You get a realistic timeline before we launch.',
      },
    ],
    formTitle: 'Request inherited home sale guidance',
    formSubtitle: 'Tell us your timeline. We will outline practical next steps.',
  },
}

export const BUY_INTENT_PAGES: Record<string, LeadLandingConfig> = {
  'first-time-home-buyer': {
    intent: 'first-time-home-buyer',
    audience: 'buyer',
    path: '/buy/first-time-home-buyer',
    title: 'First time buyer guidance for Central Oregon',
    subtitle:
      'Budget, financing, and offer terms before you tour, so the first house you walk is one you can actually buy.',
    seoTitle: 'First Time Home Buyer Help in Central Oregon | Ryan Realty',
    seoDescription: 'Guidance for first time buyers in Central Oregon including budget planning neighborhoods and offer strategy.',
    heroImageUrl: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=2200&q=80',
    imageAlt: 'Modern home with mountain backdrop in evening light',
    primaryCtaLabel: 'Get my first time buyer plan',
    secondaryCtaLabel: 'Browse homes for sale',
    secondaryCtaHref: '/homes-for-sale',
    trustBullets: [
      'Each step in plain language',
      'Neighborhoods matched to commute, schools, and budget',
      'Offer and negotiation support from first tour through closing',
    ],
    challengeTitle: 'What first-time buyers usually need help with',
    challengeBullets: [
      'Full monthly cost, not just list price',
      'Which towns and streets fit daily life',
      'Writing an offer that competes without overpaying',
    ],
    processTitle: 'How we work with first-time buyers',
    processSteps: [
      'Set budget and search criteria',
      'Tour homes and compare the tradeoffs out loud',
      'Write and negotiate the offer',
    ],
    faq: [
      {
        question: 'How much cash do I need to buy',
        answer: 'It varies by loan type and price. We map expected cash to close before you start touring.',
      },
      {
        question: 'Can I buy while rates are higher',
        answer:
          'Yes. A higher rate raises the monthly payment. It does not decide the deal for you. We run the payment at today’s rate before you write an offer.',
      },
    ],
    formTitle: 'Request your first time buyer plan',
    formSubtitle: 'Tell us your price range and timeline. We will map the next steps.',
  },
  relocation: {
    intent: 'relocation',
    audience: 'buyer',
    path: '/buy/relocation',
    // Layer A H1 locked — leave exact string
    title: 'Relocating to Central Oregon with confidence',
    subtitle:
      'Neighborhoods, commute, schools, and what is actually for sale, so a short visit covers more ground.',
    seoTitle: 'Relocation Real Estate Help in Central Oregon | Ryan Realty',
    seoDescription: 'Planning a move to Central Oregon. Get practical relocation support and neighborhood guidance from local experts.',
    heroImageUrl: 'https://images.unsplash.com/photo-1530538987395-032d1800fdd4?auto=format&fit=crop&w=2200&q=80',
    imageAlt: 'Mountain town neighborhood at golden hour',
    primaryCtaLabel: 'Get my relocation plan',
    secondaryCtaLabel: 'Explore area guides',
    secondaryCtaHref: '/area-guides',
    trustBullets: [
      'A short list of towns and neighborhoods from your priorities',
      'Virtual tours and in-person days when you are here',
      'Offer timing tied to your move date and financing',
    ],
    challengeTitle: 'What slows a remote move',
    challengeBullets: [
      'Too many cities and neighborhoods on the first pass',
      'Wasted tour days when you only have a long weekend',
      'Offer timing that ignores packing, jobs, and loan lock dates',
    ],
    processTitle: 'How relocation support works',
    processSteps: [
      'Define commute, schools, outdoor access, and budget',
      'Build a focused neighborhood shortlist',
      'Tour and write the offer on your calendar, not ours',
    ],
    faq: [
      {
        question: 'Can we start remotely',
        answer: 'Yes. We do remote planning, video walk-throughs, and offer prep before you travel.',
      },
      {
        question: 'Which cities should we consider first',
        answer:
          'That depends on budget, commute tolerance, and how much space you need. We ask those first, then cut the city list before you tour.',
      },
    ],
    formTitle: 'Request your relocation consultation',
    formSubtitle: 'Share your move timeline and priorities. We will send a focused plan.',
  },
  investment: {
    intent: 'investment',
    audience: 'buyer',
    path: '/buy/investment',
    title: 'Investment property strategy in Central Oregon',
    subtitle:
      'Price, rent, demand, and resale position before you write the offer. The buy box comes first; the tour comes second.',
    seoTitle: 'Central Oregon Investment Property Guidance | Ryan Realty',
    seoDescription: 'Looking for an investment property in Central Oregon. Get data driven acquisition guidance from Ryan Realty.',
    heroImageUrl: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=2200&q=80',
    imageAlt: 'Modern home exterior and neighborhood street view',
    primaryCtaLabel: 'Get my investment strategy call',
    secondaryCtaLabel: 'View market reports',
    secondaryCtaHref: '/housing-market',
    trustBullets: [
      'A buy box built from numbers you can check',
      'Neighborhood and inventory facts from the MLS',
      'Underwriting assumptions written down before offers',
    ],
    challengeTitle: 'Questions we answer with comps and rent rolls',
    challengeBullets: [
      'Which streets still have durable tenant or vacation demand',
      'How cash flow stacks against appreciation risk',
      'How to structure offers in competitive submarkets',
    ],
    processTitle: 'How we work with investors',
    processSteps: [
      'Define buy box and risk limits',
      'Source and underwrite candidate inventory',
      'Negotiate and close against the thesis you wrote down',
    ],
    faq: [
      {
        question: 'Do you work with out of state investors',
        answer: 'Yes. Remote planning and local execution through acquisition.',
      },
      {
        question: 'Can you help with portfolio expansion',
        answer: 'Yes. We can stage purchases by budget and target return.',
      },
    ],
    formTitle: 'Request investment property guidance',
    formSubtitle: 'Share your criteria. We will send a focused acquisition plan.',
  },
}

export function getSellLanding(intent: string): LeadLandingConfig | null {
  return SELL_INTENT_PAGES[intent] ?? null
}

export function getBuyLanding(intent: string): LeadLandingConfig | null {
  return BUY_INTENT_PAGES[intent] ?? null
}

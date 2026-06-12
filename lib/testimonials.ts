/**
 * Shared testimonials (Google/Zillow reviews) for home social proof and /reviews page.
 */
export type TestimonialSource = 'Google' | 'Zillow'

export type Testimonial = {
  quote: string
  author: string
  source: TestimonialSource
}

/** Testimonials from Ryan Realty Google Business Profile. Pulled 2026-05-22 via GBP API. */
export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I'd highly recommend Matt Ryan as his attention to detail and art of the negotiations with data on both buyers/sellers is impressive. He seems to navigate the process between buyers / sellers to a \"T\" and he exemplifies the communication and clarity. You will not be disappointed.",
    author: "Ernie Oster",
    source: "Google",
  },
  {
    quote:
      "Matt is the most professional, communicative, and honest Real Estate Broker I have ever worked with. Matt kept me informed on a weekly basis as to the progress of selling my home in the Bend area. He had very constructive ideas to improve my property and always found a reasonable subcontractor to improve my chances of selling my home. If you are selling or buying a home I suggest you contact Matt Ryan immediately. Matt is the best!",
    author: "Douglas Grant",
    source: "Google",
  },
  {
    quote:
      "We had an excellent experience working with Matt! He was smart, understood our needs right away, and acted quickly while staying calm and patient throughout the process. Even in a tough market, he sold our home faster than we expected. Truly the best, highly recommend!",
    author: "Audra Hedberg",
    source: "Google",
  },
  {
    quote:
      "Matt worked really hard for us and is a highly skilled negotiator. He takes his role seriously as an agent looking out for your best interests and is definitely not like other realtors just trying to make a quick buck. He analyzed the market very thoroughly and helped us make a really good choice. We would work with him again anytime.",
    author: "Nick Crawley",
    source: "Google",
  },
  {
    quote:
      "After interviewing several agents my wife and I selected Matt to represent us in the estate sale of a three bedroom home. The house needed interior paint, carpet etc. Matt promptly found two contractors to make the repairs at a reasonable price. He took time to check on the repairs while we were out of the country on vacation. Upon our return we found the house freshly painted, sparkling clean and ready to sell. He took excellent photos and video of the property for the listing. The house sold quickly.",
    author: "Jim Creekmore",
    source: "Google",
  },
  {
    quote:
      "From the start of our journey to the end, Matt was right at every turn. Selling a house is an emotional roller coaster and Matt helped manage the downs while predicting the ups. I highly recommend Ryan Realty for both buying and selling!",
    author: "Doug Millard",
    source: "Google",
  },
  {
    quote:
      "Matt did a great job helping us sell our home. His presentation and marketing were professional and thorough. He was patient, low pressure with us and provided expert guidance. We would not hesitate to recommend or use Matt's services again.",
    author: "Gary Timms",
    source: "Google",
  },
  {
    quote:
      "Matt is driven, honest and hard working without the high pressure. He listens and is extremely helpful with every step in the process. He helped us find and purchase land, helped line up a builder for a new house. He then sold our current house in less than a week. We highly recommend Matt and will use him again when needed.",
    author: "Charise Millard",
    source: "Google",
  },
  {
    quote:
      "Matt was invaluable in guiding us through our purchase. He is responsive, professional, and above all, a trustworthy person. Matt was always willing to assist us no matter the numerous questions we asked, connecting us with local resources, arranging contractors, and generally helping us jump through the various hoops that it takes to buy a house from out-of-state. We highly recommend Matt!",
    author: "Stephen Graham",
    source: "Google",
  },
  {
    quote:
      "Matt was amazing to work with. He went the extra mile to help us out while selling our house while we were out of the country. He is prompt to respond and very proactive for getting things done.",
    author: "SwankHQ",
    source: "Google",
  },
  {
    quote:
      "Matt Ryan is the man!!!!! We worked with Matt over a long time in deciding to rent or sell our home. Matt worked diligently in providing information for both options and gave excellent advice to our current situation. Even after choosing to rent the property Matt continued to work for us in helping get the home ready to rent. I am extremely grateful for his help and guidance. So So Grateful!!!! Thank you",
    author: "David Town",
    source: "Google",
  },
  {
    quote:
      "Our experience with Realtor Broker Matt Ryan has been superior. Matt provided Realtor expertise and much more to guide our sales transaction to the finish line. Realtor Matt has vital local knowledge, pays attention to detail and has excellent communication skills. It's a tall order fulfilled when a Realtor can successfully provide all of these services. How do I know this? As a Realtor Broker with 23 years of full time service of my own…. I know what it takes to be a top notch professional Realtor. Bravo Matt, we'll gladly continue recommend you!",
    author: "Helen Luna Fess",
    source: "Google",
  },
  {
    quote:
      "Looked at many realtors and interviewed several. Matt was the one we decided on and were 100% happy with the process",
    author: "Kim Anderson",
    source: "Google",
  },
  {
    quote:
      "Matt with Ryan Realty was great to work with. He consistently kept us in the loop & and worked hard representing in the selling of our property. We plan to use Matt again when we need a realtor.",
    author: "D Detweiler",
    source: "Google",
  },
  {
    quote:
      "Fantastic professional service. Goes the extra mile to cover the needs of his customers. Always prompt with replies and providing up to date information. Highly recommended.",
    author: "Paul Robinson",
    source: "Google",
  },
  {
    // Buyer-side review naming Rebecca — verified via GBP API pull 2026-06-12
    // (tmp/figma-lp-build/gbp-reviews-live-2026-06-12.json, created 2025-02-24).
    quote:
      "I cannot recommend Ryan Realty enough! Our realtor, Rebecca, went above and beyond for us. She advocated fiercely for us, was extremely detail oriented and made sure we were always comfortable when negotiating. She always kept us on track and didn't allow us to settle even when our home search was at times frustrating. Matt also jumped in and offered his time and expertise, we cannot thank them both enough for all the time and energy they gave us during our hunt!",
    author: "Lauren Dewey",
    source: "Google",
  },
]

export const GOOGLE_REVIEWS_URL = "https://www.google.com/maps/search/?api=1&query=Ryan+Realty+Bend+OR"

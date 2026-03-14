# Copy and Brokers from ryan-realty.com (reference only)

Use this for **copy only** when populating the new site’s About page, broker profiles, and headshots. It does not change the design or behavior of the new app.

**Headshots:** Profile pages on the current site have broker photos. You can:
- Save images from https://ryan-realty.com/matt-ryan/, https://ryan-realty.com/rebecca-ryser-peterson/, https://ryan-realty.com/paul-stevenson/
- Upload them to Supabase Storage (e.g. `brokers/matt-ryan.jpg`) and set `photo_url` in the `brokers` table to the public URL
- Or use the same image URLs from the current site if they are stable and CORS/public

---

## Office (footer / contact)

- **Address:** 115 NW Oregon Ave, Suite #2, Bend, Oregon 97703  
- **Phone:** 541-213-6706  
- **Email:** [email protected]

---

## About page (site_pages key: `about`)

**Title:** About Ryan Realty

**Body (suggested, from current site):**

Central Oregon is renowned for its outdoor recreation and natural splendor, and at Ryan Realty, we are passionate about helping you call it home. We combine local market mastery with a genuine love for our community. Let our team of dedicated brokers provide the personalized, transparent support you need to secure your piece of the Pacific Northwest.

"Our deep connection to Bend isn't just a selling point – it's the heart of who we are and how we work."

**Why Work With Ryan Realty**

The Ryan Realty team is a group of skilled professionals dedicated to your real estate needs. We bring expertise, commitment, and a personal approach to every interaction, building trust through attentive service and reliable results. Our goal isn't just to meet expectations—it's to exceed them.

Guided by our mission of building community through authentic relationships and exceptional customer service, we're with you from start to finish. Living and working in Central Oregon, we take pride in connecting clients to the homes and people that make this area special. With Ryan Realty, you're part of our community.

---

## Brokers (for `brokers` table)

Insert/update in Supabase. Use `slug` for `/team/[slug]`. Set `photo_url` after you have headshot URLs.

### 1. Matt Ryan

| Field | Value |
|-------|--------|
| slug | `matt-ryan` |
| display_name | Matt Ryan |
| title | Owner & Principal Broker |
| phone | (541) 703-3095 |
| email | matt@ryan-realty.com |
| sort_order | 0 |

**bio:**

As the Owner and Principal Broker at Ryan Realty LLC, I am committed to upholding the highest standards of integrity, professionalism, and discretion in every transaction. Whether serving discerning homeowners or dedicated home buyers, I provide tailored, white-glove service to meet your unique needs. My mission is to deliver unparalleled expertise and a seamless real estate experience, earning your trust and business while ensuring your complete satisfaction.

My love for real estate began with a family member whose work as a realtor showed me how homeownership can transform lives—not just through financial growth, but by creating spaces where memories are built and dreams take root. This inspiration guides my work at Ryan Realty in Bend, where I help clients navigate Central Oregon's dynamic, sought-after market with care and confidence.

Before real estate, I worked in the fire service, quietly supporting people through tough moments. That time taught me the value of earning trust through steady, reliable service—a principle I carry into every client relationship. To me, serving others means listening deeply, acting with integrity, and honoring the trust placed in me. At Ryan Realty, we're here to make your journey, whether selling a cherished home or finding a new one, feel seamless and meaningful.

For homeowners, I combine local market expertise, innovative tools, and thoughtful negotiation to ensure you get the most value for the place where you've built your life. For those drawn to Bend's vibrant lifestyle, I'm committed to finding a home that feels like the perfect fit for this extraordinary community. We see ourselves as stewards of this special place, helping newcomers embrace the Bend way of life while keeping its unique spirit alive.

I'd be honored to guide you through your next step in Central Oregon's real estate market. Let's connect to explore how we can make your vision a reality, with trust and care every step of the way.

Founding Ryan Realty was my way of honoring the profound influence of my mentor, Hjalmar "Red" Erickson, whose Erickson Realty in Santa Monica was built on unwavering honesty and genuine care. These values transformed clients into lifelong friends and elevated his work beyond mere transactions. His gift for fostering community through every deal showed me the lasting impact this profession can have. I'm deeply grateful for the lessons Red imparted, which now guide Ryan Realty in Central Oregon.

---

### 2. Rebecca Ryser Peterson

| Field | Value |
|-------|--------|
| slug | `rebecca-ryser-peterson` |
| display_name | Rebecca Ryser Peterson |
| title | Broker |
| phone | (415) 308-9087 |
| email | (use contact form or office email until you have preferred) |
| sort_order | 1 |

**bio:**

Rebecca Peterson is a dedicated real estate professional in Bend, Oregon. As a longtime resident, Rebecca brings an unparalleled understanding of the local community and real estate market to her clients at Ryan Realty. As a licensed broker with Ryan Realty, Rebecca combines her fresh enthusiasm with a wealth of local knowledge and financial expertise. Her attention to detail, strong work ethic, and genuine care for her clients' needs make her an ideal partner for anyone looking to buy or sell property in Bend and the surrounding areas.

Before transitioning to real estate, Rebecca worked in private money lending, honing her analytical and financial skills. Her commitment to the Bend community extends beyond her professional life. She is actively involved in local charitable organizations and enjoys exploring Central Oregon's bike trails, lakes, ski hills, and hikes with her husband and children.

Choose Rebecca Peterson for a real estate experience that blends local insight, financial savvy, and personalized service. Whether you're a first-time homebuyer, looking to invest, or selling your property, Rebecca is dedicated to helping you achieve your real estate goals in Central Oregon.

---

### 3. Paul Stevenson

| Field | Value |
|-------|--------|
| slug | `paul-stevenson` |
| display_name | Paul Stevenson |
| title | Broker |
| phone | 541-977-6841 |
| email | (use contact form or office email until you have preferred) |
| sort_order | 2 |

**bio:**

Serving Redmond & Surrounding Areas

With over 19 years of service with La Pine Fire, I'm excited to bring my deep-rooted commitment to community and service into the world of real estate with Ryan Realty. As a long-time resident of the Redmond area, I understand the value of home, land, and the lifestyle that makes Central Oregon so special. My wife and I have been married for 27 years and are proud parents to five incredible children. We've spent over a decade raising 4-H pigs on our small piece of local property, teaching our kids the value of hard work, responsibility, and connection to the land. These experiences have given me a unique perspective on rural properties, family homes, and the importance of finding the right fit for every stage of life.

When I'm not working, you'll find me enjoying the outdoors—hiking, camping, and adventuring with family and friends. I believe that buying or selling a home is more than a transaction—it's a personal journey—and I'm here to help guide you through it with integrity, care, and local knowledge. Let's find a place you'll be proud to call home.

---

## Image URLs for headshots (optional)

If the current site serves broker images at stable URLs, you can use them until you upload your own:

- Inspect the profile pages (matt-ryan, rebecca-ryser-peterson, paul-stevenson) and copy the `src` of the main broker photo.
- Or upload screenshots/crops to Supabase Storage and set `brokers.photo_url` to the public URL.

No image URLs were captured in this doc; add them to `photo_url` in Supabase when ready.

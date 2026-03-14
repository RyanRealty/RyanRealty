-- Optional seed: brokers and About page copy from ryan-realty.com (docs/COPY_FROM_CURRENT_SITE.md).
-- Run after 20250310120000_brokers_and_site_pages.sql. photo_url is empty; add headshot URLs in Supabase or Admin.

-- About page
INSERT INTO site_pages (key, title, body_html, updated_at)
VALUES (
  'about',
  'About Ryan Realty',
  '<p>Central Oregon is renowned for its outdoor recreation and natural splendor, and at Ryan Realty, we are passionate about helping you call it home. We combine local market mastery with a genuine love for our community. Let our team of dedicated brokers provide the personalized, transparent support you need to secure your piece of the Pacific Northwest.</p>
<p>"Our deep connection to Bend isn''t just a selling point – it''s the heart of who we are and how we work."</p>
<h2>Why Work With Ryan Realty</h2>
<p>The Ryan Realty team is a group of skilled professionals dedicated to your real estate needs. We bring expertise, commitment, and a personal approach to every interaction, building trust through attentive service and reliable results. Our goal isn''t just to meet expectations—it''s to exceed them.</p>
<p>Guided by our mission of building community through authentic relationships and exceptional customer service, we''re with you from start to finish. Living and working in Central Oregon, we take pride in connecting clients to the homes and people that make this area special. With Ryan Realty, you''re part of our community.</p>
<p><a href="/team">Meet our team</a> and <a href="/listings">browse current listings</a> to get started.</p>',
  now()
)
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  body_html = EXCLUDED.body_html,
  updated_at = EXCLUDED.updated_at;

-- Brokers (photo_url left null; add in Supabase or Admin after uploading headshots)
INSERT INTO brokers (slug, display_name, title, bio, photo_url, email, phone, sort_order, is_active, updated_at)
VALUES
  (
    'matt-ryan',
    'Matt Ryan',
    'Owner & Principal Broker',
    'As the Owner and Principal Broker at Ryan Realty LLC, I am committed to upholding the highest standards of integrity, professionalism, and discretion in every transaction. Whether serving discerning homeowners or dedicated home buyers, I provide tailored, white-glove service to meet your unique needs. My mission is to deliver unparalleled expertise and a seamless real estate experience, earning your trust and business while ensuring your complete satisfaction.

My love for real estate began with a family member whose work as a realtor showed me how homeownership can transform lives—not just through financial growth, but by creating spaces where memories are built and dreams take root. This inspiration guides my work at Ryan Realty in Bend, where I help clients navigate Central Oregon''s dynamic, sought-after market with care and confidence.

Before real estate, I worked in the fire service, quietly supporting people through tough moments. That time taught me the value of earning trust through steady, reliable service—a principle I carry into every client relationship. At Ryan Realty, we''re here to make your journey, whether selling a cherished home or finding a new one, feel seamless and meaningful. I''d be honored to guide you through your next step in Central Oregon''s real estate market.',
    NULL,
    'matt@ryan-realty.com',
    '(541) 703-3095',
    0,
    true,
    now()
  ),
  (
    'rebecca-ryser-peterson',
    'Rebecca Ryser Peterson',
    'Broker',
    'Rebecca Peterson is a dedicated real estate professional in Bend, Oregon. As a longtime resident, Rebecca brings an unparalleled understanding of the local community and real estate market to her clients at Ryan Realty. As a licensed broker with Ryan Realty, Rebecca combines her fresh enthusiasm with a wealth of local knowledge and financial expertise. Her attention to detail, strong work ethic, and genuine care for her clients'' needs make her an ideal partner for anyone looking to buy or sell property in Bend and the surrounding areas.

Before transitioning to real estate, Rebecca worked in private money lending, honing her analytical and financial skills. Her commitment to the Bend community extends beyond her professional life. She is actively involved in local charitable organizations and enjoys exploring Central Oregon''s bike trails, lakes, ski hills, and hikes with her husband and children. Whether you''re a first-time homebuyer, looking to invest, or selling your property, Rebecca is dedicated to helping you achieve your real estate goals in Central Oregon.',
    NULL,
    NULL,
    '(415) 308-9087',
    1,
    true,
    now()
  ),
  (
    'paul-stevenson',
    'Paul Stevenson',
    'Broker',
    'Serving Redmond & Surrounding Areas. With over 19 years of service with La Pine Fire, I''m excited to bring my deep-rooted commitment to community and service into the world of real estate with Ryan Realty. As a long-time resident of the Redmond area, I understand the value of home, land, and the lifestyle that makes Central Oregon so special. My wife and I have been married for 27 years and are proud parents to five incredible children. We''ve spent over a decade raising 4-H pigs on our small piece of local property, teaching our kids the value of hard work, responsibility, and connection to the land.

When I''m not working, you''ll find me enjoying the outdoors—hiking, camping, and adventuring with family and friends. I believe that buying or selling a home is more than a transaction—it''s a personal journey—and I''m here to help guide you through it with integrity, care, and local knowledge. Let''s find a place you''ll be proud to call home.',
    NULL,
    NULL,
    '541-977-6841',
    2,
    true,
    now()
  )
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  title = EXCLUDED.title,
  bio = EXCLUDED.bio,
  email = COALESCE(EXCLUDED.email, brokers.email),
  phone = EXCLUDED.phone,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = EXCLUDED.updated_at;

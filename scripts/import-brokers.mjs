import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();
const sb = createClient(url, key);

async function run() {
  // Check/create brokers bucket
  const { data: buckets } = await sb.storage.listBuckets();
  const hasBrokers = buckets?.some(b => b.name === 'brokers');
  if (hasBrokers === false) {
    const { error: bucketErr } = await sb.storage.createBucket('brokers', { public: true });
    if (bucketErr) console.log('Bucket create error:', bucketErr.message);
    else console.log('Created brokers bucket');
  } else {
    console.log('Brokers bucket exists');
  }

  // Upload headshots
  const headshots = [
    { file: 'public/images/brokers/ryan-matt.jpg', path: 'headshots/ryan-matt.jpg', type: 'image/jpeg' },
    { file: 'public/images/brokers/stevenson-paul.jpg', path: 'headshots/stevenson-paul.jpg', type: 'image/jpeg' },
    { file: 'public/images/brokers/peterson-rebecca.jpg', path: 'headshots/peterson-rebecca.jpg', type: 'image/jpeg' },
  ];

  const photoUrls = {};
  for (const hs of headshots) {
    const fileData = fs.readFileSync(hs.file);
    const { data, error } = await sb.storage.from('brokers').upload(hs.path, fileData, {
      contentType: hs.type,
      upsert: true,
    });
    if (error) {
      console.log('Upload error for', hs.path, ':', error.message);
    } else {
      const { data: urlData } = sb.storage.from('brokers').getPublicUrl(hs.path);
      photoUrls[hs.path] = urlData.publicUrl;
      console.log('Uploaded:', hs.path, '->', urlData.publicUrl);
    }
  }

  // Update broker records
  const brokers = [
    {
      slug: 'matthew-ryan',
      display_name: 'Matt Ryan',
      title: 'Owner & Principal Broker',
      bio: `Matt Ryan is the Owner and Principal Broker of Ryan Realty LLC in Bend, Oregon. His passion for real estate comes from witnessing how homeownership transforms lives and builds community. Before founding Ryan Realty, Matt served in the fire service, where he developed a deep commitment to steady, reliable service and earned the trust of those around him.

Matt founded Ryan Realty to honor the legacy of his mentor Hjalmar "Red" Erickson, whose integrity and dedication to client relationships set the standard for how Matt approaches every transaction. That foundation of trust, transparency, and genuine care runs through everything Ryan Realty does.

With deep roots in Central Oregon and an intimate knowledge of the Bend real estate market, Matt and his team help buyers find the right property and sellers maximize their home value. Whether you are relocating to Bend, buying your first home, or selling a property you have loved, Matt brings the same level of care and expertise to every client relationship.`,
      email: 'matt@ryan-realty.com',
      phone: '(541) 703-3095',
      sort_order: 0,
      is_active: true,
      license_number: '201206613',
      specialties: ['Residential', 'Luxury Homes', 'Buyer Representation', 'Seller Services', 'Relocation'],
      social_facebook: 'https://www.facebook.com/RyanRealtyBend',
      social_instagram: 'https://www.instagram.com/ryanrealtybend/',
      social_linkedin: 'https://www.linkedin.com/company/ryan-realty-llc-bend-oregon/',
      social_youtube: 'https://www.youtube.com/@Ryan-Realty',
      photo_url: photoUrls['headshots/ryan-matt.jpg'] || '/images/brokers/ryan-matt.jpg',
    },
    {
      slug: 'paul-stevenson',
      display_name: 'Paul Stevenson',
      title: 'Broker',
      bio: `Paul Stevenson brings over 19 years of service-oriented experience to real estate, with a career rooted in the La Pine Fire Department. As a longtime resident of the Redmond area, Paul understands the value of home, land, and the lifestyle that makes Central Oregon special.

Married for 27 years with five children, Paul and his family have spent over a decade raising 4-H pigs on their small piece of local property, instilling values of hard work, responsibility, and connection to the land. That same dedication carries into his real estate practice.

Paul believes that buying or selling a home is more than a transaction. It is a personal journey that deserves a guide who listens, communicates honestly, and works tirelessly on your behalf. His deep knowledge of Redmond and surrounding areas, combined with his integrity and care, makes him a trusted advocate for buyers and sellers throughout Central Oregon.`,
      email: 'paul@ryan-realty.com',
      phone: '541-977-6841',
      sort_order: 1,
      is_active: true,
      license_number: '201259123',
      specialties: ['Redmond Area', 'Rural Properties', 'First-Time Buyers', 'Family Homes'],
      social_facebook: null,
      social_instagram: null,
      social_linkedin: null,
      social_youtube: null,
      photo_url: photoUrls['headshots/stevenson-paul.jpg'] || '/images/brokers/stevenson-paul.jpg',
    },
    {
      slug: 'rebecca-peterson',
      display_name: 'Rebecca Ryser Peterson',
      title: 'Broker',
      bio: `Rebecca Ryser Peterson is a dedicated broker at Ryan Realty in Bend, Oregon. As a longtime Bend resident, she brings a comprehensive understanding of the local community and real estate market to every client relationship.

Before entering real estate, Rebecca worked in private money lending, where she developed sharp analytical and financial skills that now benefit her clients during negotiations and market analysis. She has a talent for breaking down complex transactions into clear, manageable steps.

Rebecca remains actively involved in local charitable organizations and spends her free time exploring everything Central Oregon has to offer, from biking and skiing to hiking and lake days with her family. Her enthusiasm for the area is genuine, and it shows in how she helps clients find not just a house, but a lifestyle that fits.`,
      email: 'rebecca@ryanrealty.com',
      phone: '(415) 308-9087',
      sort_order: 2,
      is_active: true,
      license_number: '201254727',
      specialties: ['First-Time Buyers', 'Investment Properties', 'Residential Sales', 'Relocation'],
      social_facebook: null,
      social_instagram: null,
      social_linkedin: null,
      social_youtube: null,
      photo_url: photoUrls['headshots/peterson-rebecca.jpg'] || '/images/brokers/peterson-rebecca.jpg',
    },
  ];

  for (const broker of brokers) {
    const { error } = await sb.from('brokers').update(broker).eq('slug', broker.slug);
    if (error) {
      console.log('Update error for', broker.slug, ':', error.message);
    } else {
      console.log('Updated:', broker.slug);
    }
  }

  // Verify
  const { data: allBrokers } = await sb.from('brokers').select('slug, display_name, photo_url, email, phone, bio');
  if (allBrokers) {
    allBrokers.forEach(b => {
      const hasBio = b.bio ? 'YES (' + b.bio.length + ' chars)' : 'NO';
      console.log('VERIFY:', b.slug, '| photo:', b.photo_url ? 'YES' : 'NO', '| email:', b.email || 'NO', '| bio:', hasBio);
    });
  }
}

run().catch(e => console.error('Fatal:', e.message));

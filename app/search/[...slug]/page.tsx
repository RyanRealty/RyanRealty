import { createClient } from '@supabase/supabase-js'
import ListingMap from '../../../components/ListingMap'
import { getGeocodedListings } from '../../actions/geocode'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export default async function SearchPage({ params }: { params: { slug: string[] } }) {
  const slug = params?.slug || [];
  const city = slug[0];
  const subdivision = slug[1];

  let query = supabase.from('listings').select('*');
  if (city) query = query.ilike('City', city); 
  if (subdivision) query = query.ilike('SubdivisionName', decodeURIComponent(subdivision));

  const { data: rawListings } = await query.limit(40);
  const listings = await getGeocodedListings(rawListings || []);

  return (
    <main style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '2.2rem', textTransform: 'capitalize' }}>
          Homes in {subdivision ? decodeURIComponent(subdivision) : city || 'Central Oregon'}
        </h1>
        <p style={{ color: '#666' }}>Showing {listings.length} active listings</p>
      </header>

      <section style={{ marginBottom: '40px', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>
        <ListingMap listings={listings} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
        {listings.map((h: any) => (
          <div key={h.ListNumber} style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>
            <img 
               src={h.PhotoURL || 'https://via.placeholder.com/400x250?text=Property'} 
               style={{ width: '100%', height: '200px', objectFit: 'cover' }} 
            />
            <div style={{ padding: '15px' }}>
              <h2 style={{ margin: '0', fontSize: '1.4rem', color: '#0070f3' }}>
                ${Number(h.ListPrice || 0).toLocaleString()}
              </h2>
              <p style={{ margin: '8px 0', fontWeight: 'bold' }}>
                {h.BedroomsTotal} Bed | {h.BathroomsTotal} Bath
              </p>
              <p style={{ fontSize: '0.9rem', color: '#666' }}>{h.StreetNumber} {h.StreetName}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

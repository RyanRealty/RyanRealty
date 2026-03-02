import { createClient } from '@supabase/supabase-js'
import ListingMap from '../../../components/ListingMap'
import { getGeocodedListings } from '../../../actions/geocode'

// 1. Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export default async function SearchPage({ params }: { params: { slug: string[] } }) {
  // Use a fallback to prevent "undefined" errors
  const slug = params?.slug || [];
  const city = slug[0];
  const subdivision = slug[1];

  // 2. Fetch data from your 120-column table
  let query = supabase.from('listings').select('*');
  
  if (city) {
    query = query.ilike('City', city); 
  }
  
  if (subdivision) {
    // We decode the URL so "Caldera%20Springs" becomes "Caldera Springs"
    query = query.ilike('SubdivisionName', decodeURIComponent(subdivision));
  }

  const { data: rawListings } = await query.limit(40);

  // 3. Ensure we have an array to work with
  const safeRawListings = rawListings || [];

  // 4. Run the Geocoding engine to get Map Pins
  const listings = await getGeocodedListings(safeRawListings);

  return (
    <main style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      <header style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '2.2rem', textTransform: 'capitalize' }}>
          Homes in {subdivision ? decodeURIComponent(subdivision) : city || 'Central Oregon'}
        </h1>
        <p style={{ color: '#666' }}>Found {listings.length} active listings</p>
      </header>

      {/* THE MAP SECTION */}
      <section style={{ marginBottom: '40px', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>
        {listings.length > 0 ? (
           <ListingMap listings={listings} />
        ) : (
           <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
             No listings found for this location yet.
           </div>
        )}
      </section>

      {/* THE LISTING GRID */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
        {listings.map((h: any) => (
          <div key={h.ListNumber} style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', transition: 'transform 0.2s' }}>
            <img 
               src={h.PhotoURL || 'https://via.placeholder.com/400x250?text=Listing+Photo'} 
               alt="Property"
               style={{ width: '100%', height: '200px', objectFit: 'cover' }} 
            />
            <div style={{ padding: '15px' }}>
              <h2 style={{ margin: '0', fontSize: '1.4rem', color: '#0070f3' }}>
                ${Number(h.ListPrice || 0).toLocaleString()}
              </h2>
              <p style={{ margin: '8px 0', fontWeight: 'bold' }}>
                {h.BedroomsTotal} Bed | {h.BathroomsTotal} Bath | {h.TotalLivingAreaSqFt} SqFt
              </p>
              <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0' }}>
                {h.StreetNumber} {h.StreetName}
              </p>
              <p style={{ fontSize: '0.8rem', color: '#999' }}>{h.SubdivisionName}</p>
            </div>
          </div>
        ))}
      </section>

      {/* DYNAMIC INTERNAL LINKING (For the SEO Robot) */}
      <footer style={{ marginTop: '60px', padding: '30px 0', borderTop: '1px solid #eee' }}>
         <h4 style={{ marginBottom: '15px' }}>More Local Searches</h4>
         <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <a href="/search/Bend" style={{ color: '#0070f3', textDecoration: 'none' }}>Bend Homes</a>
            <a href="/search/Sunriver" style={{ color: '#0070f3', textDecoration: 'none' }}>Sunriver Homes</a>
            <a href="/search/Redmond" style={{ color: '#0070f3', textDecoration: 'none' }}>Redmond Homes</a>
         </div>
      </footer>
    </main>
  );
}

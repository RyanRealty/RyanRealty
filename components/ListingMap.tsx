'use client'
import Map, { Marker, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function ListingMap({ listings }: { listings: any[] }) {
  const validListings = listings.filter(l => l.Latitude && l.Longitude);

  const initialViewState = {
    latitude: validListings[0]?.Latitude || 44.0582,
    longitude: validListings[0]?.Longitude || -121.3153,
    zoom: validListings.length === 1 ? 14 : 10
  };

  return (
    <div style={{ height: '500px', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      <Map
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
      >
        <NavigationControl position="top-right" />
        {validListings.map((house) => (
          <Marker key={house.ListNumber} latitude={house.Latitude} longitude={house.Longitude}>
            <div style={{ background: '#0070f3', color: 'white', padding: '5px 10px', borderRadius: '20px', fontWeight: 'bold', fontSize: '12px' }}>
              ${(house.ListPrice / 1000).toFixed(0)}k
            </div>
          </Marker>
        ))}
      </Map>
    </div>
  );
}

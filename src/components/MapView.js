import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

export default function MapView({ filter, refreshKey }) {
  const [points, setPoints] = useState([]);

  useEffect(() => {
    supabase
      .from('points')
      .select('*')
      .then(({ data, error }) => {
        if (error) return alert(error.message);
        setPoints(filter === 'all' ? data : data.filter(p => p.status === filter));
      });
  }, [filter, refreshKey]);

  return (
    <MapContainer center={[48.85,2.35]} zoom={5} style={{ height: '500px', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {points.map(p => (
        <Marker key={p.id} position={[p.latitude, p.longitude]}>
          <Popup><b>{p.name}</b><br />Statut : {p.status}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
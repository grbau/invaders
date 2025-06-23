import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

function PointsList({ filter }) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);

 useEffect(() => {
    const fetchPoints = async () => {
      setLoading(true);

      let query = supabase.from('points').select('*');

      // Appliquer le filtre via le champ `status`
      if (filter === 'selected') {
        query = query.eq('status', 'selected');
      } else if (filter === 'to_select') {
        query = query.eq('status', 'to_select');
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erreur de récupération :', error.message);
      } else {
        setPoints(data);
      }

      setLoading(false);
    };

    fetchPoints();
  }, [filter]);

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <h2>Liste des points</h2>
      <ul>
        {points.map((point) => (
          <li key={point.id}>
            {JSON.stringify(point)}
            {point.name} – {point.value}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PointsList;
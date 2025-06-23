import { useState } from 'react';
import { supabase } from '../services/supabaseClient';

export default function PointForm({ onAdded }) {
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', status: 'to_select' });

  const handleSubmit = async e => {
    e.preventDefault();
    const { error } = await supabase.from('points').insert([{
      name: form.name,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      status: form.status
    }]);
    if (error) alert(error.message);
    else {
      onAdded();
      setForm({ name: '', latitude: '', longitude: '', status: 'to_select' });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input placeholder="Nom" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
      <input type="number" placeholder="Latitude" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} required />
      <input type="number" placeholder="Longitude" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} required />
      <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
        <option value="to_select">À sélectionner</option>
        <option value="selected">Sélectionné</option>
      </select>
      <button type="submit">Ajouter</button>
    </form>
  );
}
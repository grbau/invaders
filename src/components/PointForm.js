import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { useUser } from '../contexts/UserContext';
import { usePoints } from '../contexts/PointsContext';

export default function PointForm() {
  const { currentProfile } = useUser();
  const { refreshPoints } = usePoints();

  const initialFormState = {
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    points: '',
    status: 'to_select',
  };

  const [form, setForm] = useState(initialFormState);
  const [suggestions, setSuggestions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const skipFetchRef = useRef(false);

  const fetchSuggestions = async (query) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await res.json();
      const unique = data.filter(
        (s, index, self) => index === self.findIndex(t => t.display_name === s.display_name)
      );
      setSuggestions(unique);
    } catch (error) {
      console.error('Erreur lors de la récupération des suggestions :', error);
    }
  };

  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchSuggestions(form.address);
    }, 300);
    return () => clearTimeout(timer);
  }, [form.address]);

  const handleSelectSuggestion = (s) => {
    skipFetchRef.current = true;
    setForm({
      ...form,
      address: s.display_name,
      latitude: s.lat,
      longitude: s.lon,
    });
    setSuggestions([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentProfile) {
      alert('Veuillez sélectionner un profil');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('points')
        .insert([{
          name: form.name,
          address: form.address,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
          points: parseInt(form.points) || 0,
          status: form.status,
          profile_id: currentProfile.id,
        }]);

      if (error) throw error;

      setForm(initialFormState);
      setSuggestions([]);
      refreshPoints();
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClasses = "w-full h-11 px-4 border border-grey-300 bg-white text-grey-700 placeholder-grey-500 input-focus transition-all";
  const labelClasses = "block text-xs font-medium text-grey-500 uppercase tracking-wide mb-2";

  return (
    <form onSubmit={handleSubmit}>
      {/* Layout horizontal sur desktop, vertical sur mobile */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        {/* Nom du point */}
        <div className="md:col-span-2">
          <label className={labelClasses}>
            Nom
          </label>
          <input
            type="text"
            placeholder="Mon point"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClasses}
          />
        </div>

        {/* Adresse */}
        <div className="relative md:col-span-3">
          <label className={labelClasses}>
            Adresse
          </label>
          <input
            type="text"
            placeholder="Rechercher une adresse..."
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className={inputClasses}
          />

          {suggestions.length > 0 && (
            <ul className="absolute z-20 w-full bg-white border border-grey-300 shadow-lg mt-1 max-h-48 overflow-y-auto custom-scrollbar">
              {suggestions.map((s, idx) => (
                <li
                  key={idx}
                  onClick={() => handleSelectSuggestion(s)}
                  className="px-4 py-3 hover:bg-primary-50 cursor-pointer text-sm text-grey-700 transition border-b border-grey-100 last:border-b-0"
                >
                  <span className="text-primary-500 mr-2">
                    <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </span>
                  {s.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Latitude */}
        <div className="md:col-span-2">
          <label className={labelClasses}>
            Latitude
          </label>
          <input
            type="number"
            step="any"
            placeholder="48.8566"
            value={form.latitude}
            onChange={(e) => setForm({ ...form, latitude: e.target.value })}
            required
            className={inputClasses}
          />
        </div>

        {/* Longitude */}
        <div className="md:col-span-2">
          <label className={labelClasses}>
            Longitude
          </label>
          <input
            type="number"
            step="any"
            placeholder="2.3522"
            value={form.longitude}
            onChange={(e) => setForm({ ...form, longitude: e.target.value })}
            required
            className={inputClasses}
          />
        </div>

        {/* Nombre de points */}
        <div className="md:col-span-1">
          <label className={labelClasses}>
            Points
          </label>
          <input
            type="number"
            placeholder="5"
            value={form.points}
            onChange={(e) => setForm({ ...form, points: e.target.value })}
            className={inputClasses}
          />
        </div>

        {/* Statut */}
        <div className="md:col-span-2">
          <label className={labelClasses}>
            Statut
          </label>
          <div className="flex h-11">
            <button
              type="button"
              onClick={() => setForm({ ...form, status: 'to_select' })}
              className={`flex-1 px-3 text-sm font-medium transition-colors ${
                form.status === 'to_select'
                  ? 'bg-warning-50 text-warning-700 border-2 border-warning-500'
                  : 'bg-grey-100 text-grey-500 border border-grey-300 hover:bg-grey-200'
              }`}
            >
              À flasher
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, status: 'selected' })}
              className={`flex-1 px-3 text-sm font-medium transition-colors ${
                form.status === 'selected'
                  ? 'bg-success-50 text-success-700 border-2 border-success-500'
                  : 'bg-grey-100 text-grey-500 border border-grey-300 hover:bg-grey-200'
              }`}
            >
              Flashé
            </button>
          </div>
        </div>

        {/* Bouton submit */}
        <div className="md:col-span-1">
          <button
            type="submit"
            disabled={isSubmitting || !currentProfile}
            className="w-full h-11 bg-primary-500 hover:bg-primary-600 text-white font-medium btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Ajout...' : 'Ajouter'}
          </button>
        </div>
      </div>
    </form>
  );
}

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { useUser } from '../contexts/UserContext';
import { usePoints } from '../contexts/PointsContext';

export default function PointForm() {
  const { currentProfile } = useUser();
  const { refreshPoints, allPoints } = usePoints();

  const initialFormState = {
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    points: '',
    status: 'to_select',
    destroyed: false,
    description: '',
  };

  const [form, setForm] = useState(initialFormState);
  const [suggestions, setSuggestions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const skipFetchRef = useRef(false);
  const addressContainerRef = useRef(null);
  const nameContainerRef = useRef(null);

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

  // Fermer les suggestions quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addressContainerRef.current && !addressContainerRef.current.contains(event.target)) {
        setIsAddressFocused(false);
        setSuggestions([]);
      }
      if (nameContainerRef.current && !nameContainerRef.current.contains(event.target)) {
        setIsNameFocused(false);
        setNameSuggestions([]);
      }
    };

    if ((isAddressFocused && suggestions.length > 0) || (isNameFocused && nameSuggestions.length > 0)) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddressFocused, suggestions.length, isNameFocused, nameSuggestions.length]);

  // Rechercher les suggestions de noms dans la base de données
  useEffect(() => {
    const fetchNameSuggestions = async () => {
      if (!form.name.trim() || form.name.length < 2) {
        setNameSuggestions([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('points')
          .select('name, address, latitude, longitude')
          .ilike('name', `${form.name}%`)
          .order('name')
          .limit(10);

        if (error) {
          console.error('Erreur lors de la recherche de suggestions:', error);
          return;
        }

        // Dédupliquer par nom (garder le premier de chaque nom unique)
        const uniqueSuggestions = data?.filter((point, index, self) =>
          index === self.findIndex(p => p.name.toLowerCase() === point.name.toLowerCase())
        ) || [];

        setNameSuggestions(uniqueSuggestions);
      } catch (error) {
        console.error('Erreur lors de la recherche de suggestions:', error);
      }
    };

    if (!isNameFocused) return;

    const timer = setTimeout(fetchNameSuggestions, 300);
    return () => clearTimeout(timer);
  }, [form.name, isNameFocused]);

  // Sélectionner une suggestion de nom
  const handleSelectNameSuggestion = (suggestion) => {
    setForm({
      ...form,
      name: suggestion.name,
      address: suggestion.address || '',
      latitude: suggestion.latitude || '',
      longitude: suggestion.longitude || '',
    });
    setNameSuggestions([]);
    setIsNameFocused(false);
    checkDuplicateName(suggestion.name);
  };

  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      return;
    }
    if (!isAddressFocused) {
      return;
    }
    const timer = setTimeout(() => {
      fetchSuggestions(form.address);
    }, 300);
    return () => clearTimeout(timer);
  }, [form.address, isAddressFocused]);

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

  // Vérifier si le nom existe déjà
  const checkDuplicateName = (name) => {
    if (!name.trim()) {
      setNameError('');
      return false;
    }
    const isDuplicate = allPoints.some(
      point => point.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (isDuplicate) {
      setNameError('Ce pixel existe déjà');
      return true;
    }
    setNameError('');
    return false;
  };

  // Gérer le changement de nom
  const handleNameChange = (e) => {
    const newName = e.target.value;
    setForm({ ...form, name: newName });
    checkDuplicateName(newName);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentProfile) {
      alert('Veuillez sélectionner un profil');
      return;
    }

    // Vérifier les doublons avant soumission
    if (checkDuplicateName(form.name)) {
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
          destroyed: form.destroyed,
          description: form.description,
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        {/* Nom du point */}
        <div className="relative md:col-span-1" ref={nameContainerRef}>
          <label className={labelClasses}>
            Nom
          </label>
          <input
            type="text"
            placeholder="PA_01, PA_02..."
            value={form.name}
            onChange={handleNameChange}
            onFocus={() => setIsNameFocused(true)}
            className={`${inputClasses} ${nameError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
          />
          <div className="h-5 mt-1">
            {nameError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {nameError}
              </p>
            )}
          </div>

          {nameSuggestions.length > 0 && isNameFocused && (
            <ul className="absolute z-20 w-full bg-white border border-grey-300 shadow-lg mt-1 max-h-48 overflow-y-auto custom-scrollbar top-[calc(100%-1.5rem)]">
              {nameSuggestions.map((s, idx) => (
                <li
                  key={idx}
                  onClick={() => handleSelectNameSuggestion(s)}
                  className="px-4 py-3 hover:bg-primary-50 cursor-pointer text-sm text-grey-700 transition border-b border-grey-100 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-primary-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                    </span>
                    <span className="font-medium">{s.name}</span>
                  </div>
                  {s.address && (
                    <p className="text-xs text-grey-400 mt-1 ml-6 truncate">{s.address}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Adresse */}
        <div className="relative md:col-span-1" ref={addressContainerRef}>
          <label className={labelClasses}>
            Adresse
          </label>
          <input
            type="text"
            placeholder="Rechercher une adresse..."
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            onFocus={() => setIsAddressFocused(true)}
            className={inputClasses}
          />
          <div className="h-5 mt-1"></div>

          {suggestions.length > 0 && isAddressFocused && (
            <ul className="absolute z-20 w-full bg-white border border-grey-300 shadow-lg mt-1 max-h-48 overflow-y-auto custom-scrollbar top-[calc(100%-1.5rem)]">
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
        <div className="md:col-span-1">
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
          <div className="h-5 mt-1"></div>
        </div>

        {/* Longitude */}
        <div className="md:col-span-1">
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
          <div className="h-5 mt-1"></div>
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
          <div className="h-5 mt-1"></div>
        </div>

        {/* Statut */}
        <div className="md:col-span-1">
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
          <div className="h-5 mt-1"></div>
        </div>

        {/* Description */}
        <div className="md:col-span-1">
          <label className={labelClasses}>
            Description
          </label>
          <input
            type="text"
            placeholder="Description du pixel (optionnel)..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputClasses}
          />
          <div className="h-5 mt-1"></div>
        </div>

        {/* Détruit */}
        <div className="md:col-span-1">
          <label className={labelClasses}>
            Détruit
          </label>
          <div className="flex items-center h-11">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.destroyed}
                onChange={(e) => setForm({ ...form, destroyed: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-grey-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-grey-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-error-500"></div>
            </label>
          </div>
          <div className="h-5 mt-1"></div>
        </div>

        {/* Bouton submit */}
        <div className="md:col-span-4">
          <button
            type="submit"
            disabled={isSubmitting || !currentProfile || !!nameError}
            className="h-11 px-8 bg-primary-500 hover:bg-primary-600 text-white font-medium btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Ajout...' : 'Ajouter'}
          </button>
        </div>
      </div>
    </form>
  );
}

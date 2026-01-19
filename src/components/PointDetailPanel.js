import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { usePoints } from '../contexts/PointsContext';

export default function PointDetailPanel({ point, onClose }) {
  const { refreshPoints } = usePoints();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    points: '',
    status: 'to_select',
    destroyed: false,
    description: '',
  });
  const [suggestions, setSuggestions] = useState([]);
  const skipFetchRef = useRef(false);
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const addressContainerRef = useRef(null);

  // Gérer l'animation d'entrée et le body overflow
  useEffect(() => {
    if (point) {
      // Bloquer le scroll du body
      document.body.style.overflow = 'hidden';
      // Déclencher l'animation après le montage
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [point]);

  useEffect(() => {
    if (point) {
      setForm({
        name: point.name || '',
        address: point.address || '',
        latitude: point.latitude?.toString() || '',
        longitude: point.longitude?.toString() || '',
        points: point.points?.toString() || '0',
        status: point.status || 'to_select',
        destroyed: point.destroyed || false,
        description: point.description || '',
      });
      setIsEditing(false);
    }
  }, [point]);

  // Autocomplétion d'adresse
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
    };

    if (isAddressFocused) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddressFocused]);

  useEffect(() => {
    if (!isEditing || !isAddressFocused) {
      setSuggestions([]);
      return;
    }
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchSuggestions(form.address);
    }, 300);
    return () => clearTimeout(timer);
  }, [form.address, isEditing, isAddressFocused]);

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

  // Fermeture avec animation
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  if (!point) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('points')
        .update({
          name: form.name,
          address: form.address,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
          points: parseInt(form.points) || 0,
          status: form.status,
          destroyed: form.destroyed,
          description: form.description,
        })
        .eq('id', point.id);

      if (error) throw error;

      setIsEditing(false);
      refreshPoints();
    } catch (error) {
      alert('Erreur: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce point ?')) return;

    try {
      const { error } = await supabase
        .from('points')
        .delete()
        .eq('id', point.id);

      if (error) throw error;

      refreshPoints();
      handleClose();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const inputClasses = "w-full h-11 px-4 border border-grey-300 bg-white text-grey-700 placeholder-grey-400 input-focus transition-all";
  const labelClasses = "block text-xs font-medium text-grey-500 uppercase tracking-wide mb-2";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${
          isVisible ? 'opacity-50' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-lg z-50 flex flex-col overflow-hidden transition-transform duration-300 ease-out ${
        isVisible ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-grey-200">
          <h2 className="text-h3 text-grey-700">
            {isEditing ? 'Modifier le pixel' : 'Détails du pixel'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-grey-400 hover:text-grey-700 hover:bg-grey-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nom */}
              <div>
                <label className={labelClasses}>Nom</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClasses}
                  placeholder="Nom du point"
                />
              </div>

              {/* Adresse */}
              <div className="relative" ref={addressContainerRef}>
                <label className={labelClasses}>Adresse</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  onFocus={() => setIsAddressFocused(true)}
                  className={inputClasses}
                  placeholder="Rechercher une adresse..."
                />
                {suggestions.length > 0 && isAddressFocused && (
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

              {/* Coordonnées */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClasses}>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    className={inputClasses}
                    required
                  />
                </div>
                <div>
                  <label className={labelClasses}>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    className={inputClasses}
                    required
                  />
                </div>
              </div>

              {/* Points */}
              <div>
                <label className={labelClasses}>Points</label>
                <input
                  type="number"
                  value={form.points}
                  onChange={(e) => setForm({ ...form, points: e.target.value })}
                  className={inputClasses}
                  placeholder="0"
                />
              </div>

              {/* Statut */}
              <div>
                <label className={labelClasses}>Statut</label>
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

              {/* Détruit */}
              <div>
                <label className={labelClasses}>Détruit</label>
                <div className="flex items-center h-11">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.destroyed}
                      onChange={(e) => setForm({ ...form, destroyed: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-grey-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-grey-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-error-500"></div>
                    <span className="ml-3 text-sm text-grey-700">{form.destroyed ? 'Oui' : 'Non'}</span>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={labelClasses}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-grey-300 bg-white text-grey-700 placeholder-grey-400 input-focus transition-all resize-none"
                  placeholder="Description du pixel (optionnel)..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 h-11 border border-grey-300 text-grey-700 font-medium hover:bg-grey-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-11 bg-primary-500 hover:bg-primary-600 text-white font-medium btn-primary disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Statut badge */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-3 py-1.5 text-sm font-medium ${
                  form.status === 'selected'
                    ? 'bg-success-50 text-success-700'
                    : 'bg-warning-50 text-warning-700'
                }`}>
                  {form.status === 'selected' ? 'Flashé' : 'À flasher'}
                </span>
                <span className="bg-primary-100 text-primary-700 px-3 py-1.5 text-sm font-medium">
                  {form.points || 0} pts
                </span>
                {form.destroyed && (
                  <span className="bg-error-50 text-error-700 px-3 py-1.5 text-sm font-medium">
                    Détruit
                  </span>
                )}
              </div>

              {/* Nom */}
              <div>
                <div className={labelClasses}>Nom</div>
                <p className="text-grey-700 font-medium text-lg">
                  {form.name || 'Point sans nom'}
                </p>
              </div>

              {/* Adresse */}
              {form.address && (
                <div>
                  <div className={labelClasses}>Adresse</div>
                  <p className="text-grey-700">{form.address}</p>
                </div>
              )}

              {/* Coordonnées */}
              <div>
                <div className={labelClasses}>Coordonnées</div>
                <p className="text-grey-700 font-mono text-sm">
                  {parseFloat(form.latitude)?.toFixed(6)}, {parseFloat(form.longitude)?.toFixed(6)}
                </p>
                <div className="flex flex-col gap-2 mt-2">
                  <a
                    href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary-500 hover:text-primary-700 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Google Maps
                  </a>
                  {form.name && (
                    <a
                      href={`https://www.instagram.com/explore/tags/${form.name.toUpperCase().replace(/[^A-Z0-9_]/g, '').replace(/_0+(\d)/g, '_0$1')}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-pink-500 hover:text-pink-700 text-sm"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      Voir sur Instagram
                    </a>
                  )}
                </div>
              </div>

              {/* Description */}
              {form.description && (
                <div>
                  <div className={labelClasses}>Description</div>
                  <p className="text-grey-700 whitespace-pre-wrap">{form.description}</p>
                </div>
              )}

              {/* Date de création */}
              {point.created_at && (
                <div>
                  <div className={labelClasses}>Créé le</div>
                  <p className="text-grey-700">
                    {new Date(point.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions (mode lecture) */}
        {!isEditing && (
          <div className="border-t border-grey-200 p-6 flex gap-3">
            <button
              onClick={handleDelete}
              className="flex-1 h-11 px-4 border border-error-500 text-error-500 font-medium hover:bg-error-50 transition-colors"
            >
              Supprimer
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 h-11 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium btn-primary"
            >
              Modifier
            </button>
          </div>
        )}
      </div>
    </>
  );
}

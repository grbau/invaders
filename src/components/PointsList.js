import { useState, useEffect, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import { usePoints } from '../contexts/PointsContext';
import PointDetailPanel from './PointDetailPanel';

export default function PointsList({ filter, setFilter, onSelectPoint }) {
  const { currentProfile } = useUser();
  const { allPoints } = usePoints();
  const [points, setPoints] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [selectedForRoute, setSelectedForRoute] = useState([]);
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' ou 'desc'
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);

  // Filtrer et trier les points
  useEffect(() => {
    let filteredRecords = filter === 'all'
      ? [...allPoints]
      : allPoints.filter(p => p.status === filter);

    // Trier par nom
    filteredRecords.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      if (sortOrder === 'asc') {
        return nameA.localeCompare(nameB);
      } else {
        return nameB.localeCompare(nameA);
      }
    });

    setPoints(filteredRecords);
  }, [filter, allPoints, sortOrder]);

  // Basculer l'ordre de tri
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Calculer le total des points et pixels flashés
  const totalPoints = allPoints.reduce((sum, p) => sum + (p.points || 0), 0);
  const flashedCount = allPoints.filter(p => p.status === 'selected').length;
  const totalCount = allPoints.length;

  // Gérer la sélection pour l'itinéraire
  const togglePointForRoute = (point) => {
    setSelectedForRoute(prev => {
      const isSelected = prev.some(p => p.id === point.id);
      if (isSelected) {
        return prev.filter(p => p.id !== point.id);
      }
      return [...prev, point];
    });
  };

  // Générer l'URL Google Maps avec les waypoints
  const generateGoogleMapsUrl = () => {
    if (selectedForRoute.length === 0) return;

    // Google Maps supporte: origin, destination, et waypoints entre les deux
    // Format: https://www.google.com/maps/dir/?api=1&origin=lat,lng&destination=lat,lng&waypoints=lat,lng|lat,lng

    const points = selectedForRoute;

    if (points.length === 1) {
      // Un seul point: ouvrir la navigation vers ce point
      const p = points[0];
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`, '_blank');
      return;
    }

    // Plusieurs points: créer un itinéraire
    const origin = points[0];
    const destination = points[points.length - 1];
    const waypoints = points.slice(1, -1);

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}`;

    if (waypoints.length > 0) {
      const waypointsStr = waypoints.map(p => `${p.latitude},${p.longitude}`).join('|');
      url += `&waypoints=${waypointsStr}`;
    }

    window.open(url, '_blank');
  };

  // Quitter le mode itinéraire
  const exitRouteMode = () => {
    setIsRouteMode(false);
    setSelectedForRoute([]);
  };

  const filters = [
    { key: 'all', label: 'Tous' },
    { key: 'selected', label: 'Flashés' },
    { key: 'to_select', label: 'À flasher' },
  ];

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentFilterLabel = filters.find(f => f.key === filter)?.label || 'Tous';

  return (
    <div className="bg-white shadow-card p-6 h-full flex flex-col overflow-hidden">
      {/* Header avec titre et total */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
        <h2 className="text-h2 text-grey-700">
          Points de {currentProfile?.name || '...'}
        </h2>
        <div className="bg-primary-500 text-white px-4 py-2 rounded-chip font-semibold text-sm self-start sm:self-auto">
          {flashedCount}/{totalCount} pixels · {totalPoints} pts
        </div>
      </div>

      {/* Filtres et bouton itinéraire */}
      <div className="flex items-center justify-between gap-4 mb-6">
        {/* Custom dropdown filtre */}
        <div className="relative" ref={filterDropdownRef}>
          <button
            onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
            className="h-12 px-4 pr-10 border border-grey-300 bg-white text-grey-700 text-base font-medium rounded-lg hover:border-grey-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors cursor-pointer flex items-center gap-2 min-w-[140px]"
          >
            <span>{currentFilterLabel}</span>
            <svg
              className={`w-4 h-4 text-grey-400 absolute right-3 transition-transform ${filterDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {filterDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-grey-200 rounded-lg shadow-lg py-1 z-50">
              {filters.map(f => (
                <button
                  key={f.key}
                  onClick={() => {
                    setFilter(f.key);
                    setFilterDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-base transition-colors flex items-center justify-between ${
                    filter === f.key
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-grey-700 hover:bg-grey-50'
                  }`}
                >
                  <span>{f.label}</span>
                  {filter === f.key && (
                    <svg className="w-4 h-4 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Bouton tri */}
          <button
            onClick={toggleSortOrder}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-grey-600 hover:bg-grey-100 transition-colors whitespace-nowrap"
            title={sortOrder === 'asc' ? 'Tri A-Z' : 'Tri Z-A'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sortOrder === 'asc' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              )}
            </svg>
            <span className="hidden sm:inline">{sortOrder === 'asc' ? 'A-Z' : 'Z-A'}</span>
          </button>

          {/* Bouton mode itinéraire */}
          {!isRouteMode ? (
            <button
              onClick={() => setIsRouteMode(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors whitespace-nowrap"
              title="Créer un itinéraire"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span className="hidden sm:inline">Itinéraire</span>
            </button>
          ) : (
            <button
              onClick={exitRouteMode}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-grey-600 hover:bg-grey-100 transition-colors whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="hidden sm:inline">Annuler</span>
            </button>
          )}
        </div>
      </div>

      {/* Barre d'action itinéraire */}
      {isRouteMode && (
        <div className="mb-4 p-3 bg-primary-50 border border-primary-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-primary-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {selectedForRoute.length === 0
                ? 'Sélectionnez les points pour votre itinéraire'
                : `${selectedForRoute.length} point${selectedForRoute.length > 1 ? 's' : ''} sélectionné${selectedForRoute.length > 1 ? 's' : ''}`
              }
            </span>
          </div>
          <button
            onClick={generateGoogleMapsUrl}
            disabled={selectedForRoute.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Ouvrir dans Maps
          </button>
        </div>
      )}

      {/* Liste des points */}
      <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
        {points.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-grey-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-grey-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
            <p className="text-grey-500 font-medium">Aucun point pour le moment</p>
            <p className="text-sm text-grey-300 mt-1">Ajoutez votre premier point</p>
          </div>
        ) : (
          points.map((p, index) => {
            const isSelectedForRoute = selectedForRoute.some(sp => sp.id === p.id);
            const routeOrder = selectedForRoute.findIndex(sp => sp.id === p.id) + 1;

            return (
              <div
                key={p.id}
                onClick={() => {
                  if (isRouteMode) {
                    togglePointForRoute(p);
                  } else {
                    setSelectedPoint(p);
                    onSelectPoint?.(p.id);
                  }
                }}
                className={`flex items-start gap-3 p-4 transition-colors card-hover cursor-pointer ${
                  isRouteMode && isSelectedForRoute
                    ? 'bg-primary-50 border-2 border-primary-300'
                    : 'bg-grey-50 hover:bg-grey-100'
                }`}
              >
                {/* Checkbox ou indicateur de statut */}
                {isRouteMode ? (
                  <div className="flex-shrink-0 mt-0.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isSelectedForRoute
                        ? 'bg-primary-500 text-white'
                        : 'bg-grey-200 text-grey-400'
                    }`}>
                      {isSelectedForRoute ? routeOrder : index + 1}
                    </div>
                  </div>
                ) : (
                  <div
                    className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: p.status === 'selected' ? 'var(--color-success-500)' : 'var(--color-warning-500)' }}
                  />
                )}

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-grey-700 text-base truncate">
                    {p.name || 'Point sans nom'}
                  </h3>
                  {p.address && (
                    <p className="text-sm text-grey-500 mt-1 truncate">
                      {p.address}
                    </p>
                  )}
                  <p className="text-xs text-grey-400 font-mono mt-1">
                    {p.latitude?.toFixed(4)}, {p.longitude?.toFixed(4)}
                  </p>
                </div>

                {/* Points */}
                <div className="flex-shrink-0">
                  <span className={`px-3 py-1 rounded-chip text-sm font-medium ${
                    p.status === 'selected'
                      ? 'badge-success'
                      : 'badge-warning'
                  }`}>
                    {p.points || 0} pts
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Panel de détail */}
      {selectedPoint && (
        <PointDetailPanel
          point={selectedPoint}
          onClose={() => {
            setSelectedPoint(null);
            onSelectPoint?.(null); // Fermer aussi la popup sur la carte
          }}
        />
      )}
    </div>
  );
}

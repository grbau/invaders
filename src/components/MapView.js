import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useState, useMemo, useRef } from 'react';
import L from 'leaflet';
import { usePoints } from '../contexts/PointsContext';

// Couleurs des markers (correspondant aux variables CSS)
const MARKER_COLORS = {
  success: '#22C55E', // var(--color-success-500)
  warning: '#F59E0B', // var(--color-warning-500)
};

// Créer des icônes personnalisées pour les markers
const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          background-color: white;
          width: 8px;
          height: 8px;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

// Composant pour gérer le fly vers un point sélectionné
function FlyToPoint({ point }) {
  const map = useMap();

  useEffect(() => {
    if (point) {
      map.flyTo([point.latitude, point.longitude], 15, {
        duration: 1
      });
    }
  }, [point, map]);

  return null;
}

// Trouver la zone avec le plus de points dans un rayon de 20km
function findBestCenter(points) {
  if (points.length === 0) return null;
  if (points.length === 1) return { lat: points[0].latitude, lng: points[0].longitude };

  let bestCenter = null;
  let maxCount = 0;

  // Pour chaque point, compter combien de points sont dans un rayon de 20km
  points.forEach(p => {
    let count = 0;
    points.forEach(other => {
      const distance = getDistanceKm(p.latitude, p.longitude, other.latitude, other.longitude);
      if (distance <= 20) count++;
    });
    if (count > maxCount) {
      maxCount = count;
      bestCenter = { lat: p.latitude, lng: p.longitude };
    }
  });

  return bestCenter;
}

// Calculer la distance en km entre deux points (formule Haversine)
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Composant pour centrer la carte au chargement
function InitialCenter({ points }) {
  const map = useMap();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized || points.length === 0) return;

    // Essayer d'abord la géolocalisation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          map.setView([position.coords.latitude, position.coords.longitude], 11);
          setInitialized(true);
        },
        () => {
          // Si géolocalisation refusée, centrer sur la zone avec le plus de points
          const bestCenter = findBestCenter(points);
          if (bestCenter) {
            map.setView([bestCenter.lat, bestCenter.lng], 11);
          }
          setInitialized(true);
        },
        { timeout: 3000 }
      );
    } else {
      // Pas de géolocalisation disponible
      const bestCenter = findBestCenter(points);
      if (bestCenter) {
        map.setView([bestCenter.lat, bestCenter.lng], 11);
      }
      setInitialized(true);
    }
  }, [map, points, initialized]);

  return null;
}

export default function MapView({ filter, selectedPointId, onClosePopup }) {
  const { allPoints } = usePoints();
  const [points, setPoints] = useState([]);
  const markerRefs = useRef({});

  const greenIcon = useMemo(() => createCustomIcon(MARKER_COLORS.success), []);
  const orangeIcon = useMemo(() => createCustomIcon(MARKER_COLORS.warning), []);

  // Trouver le point sélectionné
  const selectedPoint = useMemo(() => {
    return selectedPointId ? allPoints.find(p => p.id === selectedPointId) : null;
  }, [selectedPointId, allPoints]);

  // Ouvrir/fermer la popup du marker sélectionné
  useEffect(() => {
    if (selectedPointId && markerRefs.current[selectedPointId]) {
      setTimeout(() => {
        markerRefs.current[selectedPointId]?.openPopup();
      }, 1000); // Attendre la fin de l'animation flyTo
    } else if (selectedPointId === null) {
      // Fermer toutes les popups quand aucun point n'est sélectionné
      Object.values(markerRefs.current).forEach(marker => {
        marker?.closePopup();
      });
    }
  }, [selectedPointId]);

  // Filtrer les points selon le filtre actif
  useEffect(() => {
    const filteredRecords = filter === 'all'
      ? allPoints
      : allPoints.filter(p => p.status === filter);
    setPoints(filteredRecords);
  }, [filter, allPoints]);

  return (
    <MapContainer
      center={[46.603354, 1.888334]}
      zoom={8}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <FlyToPoint point={selectedPoint} />
      <InitialCenter points={allPoints} />
      {points.map(p => (
        <Marker
          key={p.id}
          position={[p.latitude, p.longitude]}
          icon={p.status === 'selected' ? greenIcon : orangeIcon}
          ref={(ref) => { markerRefs.current[p.id] = ref; }}
          eventHandlers={{
            popupclose: () => onClosePopup?.()
          }}
        >
          <Popup>
            <div className="p-1 min-w-[180px]">
              <div className="font-semibold text-grey-700 text-base mb-2">
                {p.name || 'Point sans nom'}
              </div>
              {p.address && (
                <div className="text-xs text-grey-500 mb-2 truncate max-w-[200px]">
                  {p.address}
                </div>
              )}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-grey-500">Statut</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    p.status === 'selected'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {p.status === 'selected' ? 'Flashé' : 'À flasher'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-grey-500">Points</span>
                  <span className="font-semibold text-grey-700">{p.points || 0} pts</span>
                </div>
                <div className="pt-2 border-t border-grey-100">
                  <span className="text-grey-400 text-xs font-mono">
                    {p.latitude?.toFixed(4)}, {p.longitude?.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

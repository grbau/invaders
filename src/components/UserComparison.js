import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../services/supabaseClient';

export default function UserComparison() {
  const { profiles } = useUser();
  const [selectedProfiles, setSelectedProfiles] = useState([]);
  const [pointsByProfile, setPointsByProfile] = useState({});
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTransfertMode, setIsTransfertMode] = useState(false);
  const [selectedPointsForTransfert, setSelectedPointsForTransfert] = useState([]);
  const [showTransfertModal, setShowTransfertModal] = useState(false);
  const [targetProfileId, setTargetProfileId] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferMessage, setTransferMessage] = useState(null);
  const [transferStatus, setTransferStatus] = useState('keep'); // 'keep', 'to_select', 'selected'
  const [showOnlyDifferentStatus, setShowOnlyDifferentStatus] = useState(false);
  
  // Charger les points pour les profils sélectionnés
  useEffect(() => {
    const fetchPointsForProfiles = async () => {
      if (selectedProfiles.length === 0) {
        setPointsByProfile({});
        return;
      }

      setLoading(true);
      const pointsMap = {};

      try {
        for (const profileId of selectedProfiles) {
          const { data, error } = await supabase
            .from('points')
            .select('*')
            .eq('profile_id', profileId);

          if (!error && data) {
            pointsMap[profileId] = data;
          }
        }
        setPointsByProfile(pointsMap);
      } catch (error) {
        console.error('Erreur lors du chargement des points:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPointsForProfiles();
  }, [selectedProfiles]);

  // Toggle la sélection d'un profil
  const toggleProfile = (profileId) => {
    setSelectedProfiles(prev => {
      if (prev.includes(profileId)) {
        return prev.filter(id => id !== profileId);
      }
      return [...prev, profileId];
    });
  };

  // Toggle la sélection d'un point pour le transfert
  const togglePointForTransfert = (point) => {
    setSelectedPointsForTransfert(prev => {
      const isAlreadySelected = prev.some(p => p.key === point.key);
      if (isAlreadySelected) {
        return prev.filter(p => p.key !== point.key);
      }
      return [...prev, point];
    });
  };

  // Vérifier si un point est sélectionné pour le transfert
  const isPointSelectedForTransfert = (point) => {
    return selectedPointsForTransfert.some(p => p.key === point.key);
  };

  // Annuler le mode transfert
  const cancelTransfertMode = () => {
    setIsTransfertMode(false);
    setSelectedPointsForTransfert([]);
    setShowTransfertModal(false);
    setTargetProfileId('');
  };

  // Ouvrir le modal de transfert
  const openTransfertModal = () => {
    setShowTransfertModal(true);
  };

  // Fermer le modal de transfert
  const closeTransfertModal = () => {
    setShowTransfertModal(false);
    setTargetProfileId('');
    setTransferStatus('keep');
  };

  // Copier les points sélectionnés vers le profil cible
  const copyPointsToProfile = async () => {
    if (!targetProfileId || selectedPointsForTransfert.length === 0) return;

    setTransferLoading(true);
    setTransferMessage(null);

    try {
      // Récupérer les données complètes des points depuis pointsByProfile
      const pointsToInsert = selectedPointsForTransfert.map(point => {
        // Trouver le point original avec toutes ses données
        let originalPoint = null;
        for (const profileId of point.profilesWithPoint) {
          const profilePoints = pointsByProfile[profileId] || [];
          originalPoint = profilePoints.find(p =>
            p.name === point.name ||
            (p.latitude?.toFixed(4) === point.latitude?.toFixed(4) &&
             p.longitude?.toFixed(4) === point.longitude?.toFixed(4))
          );
          if (originalPoint) break;
        }

        // Déterminer le statut selon le choix de l'utilisateur
        let finalStatus;
        if (transferStatus === 'keep') {
          finalStatus = originalPoint?.status || 'selected';
        } else {
          finalStatus = transferStatus;
        }

        return {
          name: point.name,
          address: point.address,
          latitude: point.latitude,
          longitude: point.longitude,
          points: point.points,
          status: finalStatus,
          profile_id: targetProfileId,
        };
      });

      const { error } = await supabase
        .from('points')
        .insert(pointsToInsert);

      if (error) throw error;

      setTransferMessage({
        type: 'success',
        text: `${pointsToInsert.length} point${pointsToInsert.length > 1 ? 's' : ''} copié${pointsToInsert.length > 1 ? 's' : ''} avec succès !`
      });

      // Rafraîchir les données
      const { data: newData } = await supabase
        .from('points')
        .select('*')
        .eq('profile_id', targetProfileId);

      if (newData) {
        setPointsByProfile(prev => ({
          ...prev,
          [targetProfileId]: newData
        }));
      }

      // Fermer le modal et réinitialiser après un délai
      setTimeout(() => {
        closeTransfertModal();
        setSelectedPointsForTransfert([]);
        setIsTransfertMode(false);
        setTransferMessage(null);
      }, 2000);

    } catch (error) {
      console.error('Erreur lors de la copie des points:', error);
      setTransferMessage({
        type: 'error',
        text: 'Erreur lors de la copie des points. Veuillez réessayer.'
      });
    } finally {
      setTransferLoading(false);
    }
  };

  // Obtenir les profils disponibles pour le transfert (ceux qui n'ont pas déjà tous les points sélectionnés)
  const getAvailableTargetProfiles = () => {
    return validProfiles.filter(profile => {
      // Vérifier si ce profil n'a pas déjà tous les points sélectionnés
      const profilePoints = pointsByProfile[profile.id] || [];
      const hasAllPoints = selectedPointsForTransfert.every(selectedPoint =>
        profilePoints.some(p =>
          p.name === selectedPoint.name ||
          (p.latitude?.toFixed(4) === selectedPoint.latitude?.toFixed(4) &&
           p.longitude?.toFixed(4) === selectedPoint.longitude?.toFixed(4))
        )
      );
      return !hasAllPoints;
    });
  };

  // Calculer les points communs et différences
  const getComparisonData = () => {
    if (selectedProfiles.length < 2) return null;

    // Créer un map de tous les points par leur nom (ou coordonnées comme clé unique)
    const allPointsMap = new Map();

    selectedProfiles.forEach(profileId => {
      const points = pointsByProfile[profileId] || [];
      points.forEach(point => {
        // Utiliser le nom comme clé, ou les coordonnées si pas de nom
        const key = point.name || `${point.latitude?.toFixed(4)},${point.longitude?.toFixed(4)}`;
        if (!allPointsMap.has(key)) {
          allPointsMap.set(key, {
            name: point.name || 'Sans nom',
            address: point.address,
            latitude: point.latitude,
            longitude: point.longitude,
            profilesWithPoint: new Set(),
            pointsValue: point.points || 0,
            statusByProfile: {}, // Statut par profil
          });
        }
        const mapEntry = allPointsMap.get(key);
        mapEntry.profilesWithPoint.add(profileId);
        mapEntry.statusByProfile[profileId] = point.status || 'selected';
      });
    });

    // Séparer les points communs et les différences
    const commonPoints = [];
    const differences = [];

    allPointsMap.forEach((data, key) => {
      const pointInfo = {
        key,
        name: data.name,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        points: data.pointsValue,
        profilesWithPoint: Array.from(data.profilesWithPoint),
        statusByProfile: data.statusByProfile,
      };

      if (data.profilesWithPoint.size === selectedProfiles.length) {
        commonPoints.push(pointInfo);
      } else {
        differences.push(pointInfo);
      }
    });

    // Tri des points par nom (alphabétique)
    differences.sort((a, b) => a.name.localeCompare(b.name));

    return { commonPoints, differences };
  };

  const comparisonData = getComparisonData();

  // Obtenir le profil par ID
  const getProfile = (profileId) => profiles.find(p => p.id === profileId);

  // Filtrer les profils valides (pas les IDs par défaut)
  const validProfiles = profiles.filter(p => !p.id.startsWith('default-'));

  if (validProfiles.length < 2) {
    return null; // Pas assez de profils pour comparer
  }

  const hasDifferentStatuses = (point) => {
    const statuses =Object.values(point.statusByProfile);
    return new Set(statuses).size > 1;
  }

  return (
    <div className="bg-white shadow-card p-6">
      {/* Header cliquable pour expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <h2 className="text-h2 text-grey-700">Comparer les utilisateurs</h2>
        <svg
          className={`w-5 h-5 text-grey-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-6">
          {/* Sélection des profils */}
          <div className="mb-6">
            <p className="text-sm text-grey-500 mb-3">Sélectionnez 2 utilisateurs ou plus à comparer :</p>
            <div className="flex flex-wrap gap-2">
              {validProfiles.map(profile => {
                const isSelected = selectedProfiles.includes(profile.id);
                return (
                  <button
                    key={profile.id}
                    onClick={() => toggleProfile(profile.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-grey-200 hover:border-grey-300'
                    }`}
                  >
                    {profile.picture ? (
                      <img
                        src={profile.picture}
                        alt={profile.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: profile.color }}
                      >
                        {profile.initials}
                      </div>
                    )}
                    <span className={`text-sm font-medium ${isSelected ? 'text-primary-700' : 'text-grey-700'}`}>
                      {profile.name}
                    </span>
                    {isSelected && (
                      <svg className="w-4 h-4 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Résultats de la comparaison */}
          {loading ? (
            <div className="py-8 text-center text-grey-500">
              <svg className="animate-spin h-6 w-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Chargement...
            </div>
          ) : selectedProfiles.length < 2 ? (
            <div className="py-8 text-center text-grey-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-grey-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Sélectionnez au moins 2 utilisateurs pour voir la comparaison
            </div>
          ) : comparisonData ? (
            <div className="space-y-6">
              {/* Statistiques rapides */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{comparisonData.commonPoints.length}</div>
                  <div className="text-sm text-green-700">Points en commun</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">{comparisonData.differences.length}</div>
                  <div className="text-sm text-amber-700">Différences</div>
                </div>
                <div className="bg-primary-50 rounded-lg p-4 text-center sm:col-span-1 col-span-2">
                  <div className="text-2xl font-bold text-primary-600">
                    {comparisonData.commonPoints.length + comparisonData.differences.length}
                  </div>
                  <div className="text-sm text-primary-700">Total unique</div>
                </div>
              </div>

              {/* Tableau des points communs */}
              {comparisonData.commonPoints.length > 0 && (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <h3 className="text-base font-semibold text-grey-700 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      Points en commun ({comparisonData.commonPoints.length})
                    </h3>
                    <button
                      onClick={() => setShowOnlyDifferentStatus(!showOnlyDifferentStatus)}
                      className={`text-sm px-3 py-1.5 rounded-lg transition-colors w-fit ${
                        showOnlyDifferentStatus
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-grey-100 text-grey-600 hover:bg-grey-200'
                        }`}>
                      {showOnlyDifferentStatus ? 'Tous les points' : 'Statuts différents'}
                    </button>
                  </div>  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-grey-50">
                          <th className="px-3 py-2 text-left font-medium text-grey-600">Nom</th>
                          <th className="px-3 py-2 text-left font-medium text-grey-600">Statut</th>
                          <th className="px-3 py-2 text-left font-medium text-grey-600 hidden sm:table-cell">Adresse</th>
                          <th className="px-3 py-2 text-right font-medium text-grey-600">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-grey-100">
                        {comparisonData.commonPoints
                        .filter(point => !showOnlyDifferentStatus || hasDifferentStatuses(point))
                        .slice().sort((a, b) => a.name.localeCompare(b.name))
                        .map((point, idx) => (
                          <tr key={idx} className="hover:bg-grey-50">
                            <td className="px-3 py-2 text-grey-700">{point.name}</td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {point.profilesWithPoint.map(profileId => {
                                  const profile = getProfile(profileId);
                                  const status = point.statusByProfile[profileId];
                                  const isFlashed = status === 'selected';
                                  return profile ? (
                                    <span
                                      key={profileId}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                        isFlashed
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-amber-100 text-amber-700'
                                      }`}
                                      title={`${profile.name}: ${isFlashed ? 'Flashé' : 'À flasher'}`}
                                    >
                                      <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: profile.color }}
                                      ></span>
                                      {isFlashed ? (
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      ) : (
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-grey-500 hidden sm:table-cell truncate max-w-[200px]">
                              {point.address || '-'}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                {point.points} pts
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tableau des différences */}
              {comparisonData.differences.length > 0 && (
                <div>
                  <div className="flex sm:flex-row sm:items-center sm:justify-between flex-col mb-3 gap-2">
                    <h3 className="text-base font-semibold text-grey-700 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      Différences ({comparisonData.differences.length})
                    </h3>
                    {/* Bouton pour activer/désactiver le mode transfert */}
                    {!isTransfertMode ? (
                      <button
                        onClick={() => setIsTransfertMode(true)}
                        className="text-sm px-3 py-1.5 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Transférer des points
                      </button>
                    ) : (
                      <button
                        onClick={cancelTransfertMode}
                        className="text-sm px-3 py-1.5 bg-grey-100 text-grey-600 hover:bg-grey-200 rounded-lg transition-colors"
                      >
                        Annuler
                      </button>
                    )}
                  </div>

                  {/* Barre d'action quand des points sont sélectionnés */}
                  {isTransfertMode && selectedPointsForTransfert.length > 0 && (
                    <div className="mb-3 p-3 bg-primary-50 border border-primary-200 rounded-lg flex items-center justify-between">
                      <span className="text-sm text-primary-700">
                        {selectedPointsForTransfert.length} point{selectedPointsForTransfert.length > 1 ? 's' : ''} sélectionné{selectedPointsForTransfert.length > 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={openTransfertModal}
                        className="text-sm px-3 py-1.5 bg-primary-500 text-white hover:bg-primary-600 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Copier vers un profil
                      </button>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-grey-50">
                          {isTransfertMode && (
                            <th className="px-3 py-2 w-10"></th>
                          )}
                          <th className="px-3 py-2 text-left font-medium text-grey-600">Nom</th>
                          <th className="px-3 py-2 text-left font-medium text-grey-600">Possédé par</th>
                          <th className="px-3 py-2 text-right font-medium text-grey-600">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-grey-100">
                        {comparisonData.differences.map((point, idx) => {
                          const isSelected = isPointSelectedForTransfert(point);
                          return (
                            <tr
                              key={idx}
                              className={`hover:bg-grey-50 ${isTransfertMode ? 'cursor-pointer' : ''} ${isSelected ? 'bg-primary-50' : ''}`}
                              onClick={isTransfertMode ? () => togglePointForTransfert(point) : undefined}
                            >
                              {isTransfertMode && (
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => togglePointForTransfert(point)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 text-primary-500 border-grey-300 rounded focus:ring-primary-500"
                                  />
                                </td>
                              )}
                              <td className="px-3 py-2 text-grey-700">{point.name}</td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {point.profilesWithPoint.map(profileId => {
                                    const profile = getProfile(profileId);
                                    return profile ? (
                                      <span
                                        key={profileId}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                                        style={{
                                          backgroundColor: `${profile.color}20`,
                                          color: profile.color
                                        }}
                                      >
                                        {profile.name}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                                  {point.points} pts
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Message si aucun point */}
              {comparisonData.commonPoints.length === 0 && comparisonData.differences.length === 0 && (
                <div className="py-8 text-center text-grey-400">
                  Aucun point trouvé pour les utilisateurs sélectionnés
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Modal de transfert */}
      {showTransfertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header du modal */}
            <div className="p-4 border-b border-grey-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-grey-700">Copier les points</h3>
                <button
                  onClick={closeTransfertModal}
                  className="p-1 hover:bg-grey-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-grey-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-grey-500 mt-1">
                {selectedPointsForTransfert.length} point{selectedPointsForTransfert.length > 1 ? 's' : ''} sélectionné{selectedPointsForTransfert.length > 1 ? 's' : ''}
              </p>
            </div>

            {/* Contenu du modal */}
            <div className="p-4">
              {/* Message de feedback */}
              {transferMessage && (
                <div className={`mb-4 p-3 rounded-lg ${
                  transferMessage.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {transferMessage.type === 'success' ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className="text-sm font-medium">{transferMessage.text}</span>
                  </div>
                </div>
              )}

              {/* Liste des points à copier */}
              <div className="mb-4">
                <p className="text-sm font-medium text-grey-700 mb-2">Points à copier :</p>
                <div className="bg-grey-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <ul className="space-y-1">
                    {selectedPointsForTransfert.map((point, idx) => (
                      <li key={idx} className="text-sm text-grey-600 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                        {point.name} ({point.points} pts)
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Sélection du profil cible */}
              <div className="mb-4">
                <p className="text-sm font-medium text-grey-700 mb-2">Copier vers :</p>
                <div className="space-y-2">
                  {getAvailableTargetProfiles().map(profile => (
                    <button
                      key={profile.id}
                      onClick={() => setTargetProfileId(profile.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                        targetProfileId === profile.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-grey-200 hover:border-grey-300'
                      }`}
                    >
                      {profile.picture ? (
                        <img
                          src={profile.picture}
                          alt={profile.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: profile.color }}
                        >
                          {profile.initials}
                        </div>
                      )}
                      <span className={`font-medium ${targetProfileId === profile.id ? 'text-primary-700' : 'text-grey-700'}`}>
                        {profile.name}
                      </span>
                      {targetProfileId === profile.id && (
                        <svg className="w-5 h-5 text-primary-500 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                  {getAvailableTargetProfiles().length === 0 && (
                    <p className="text-sm text-grey-500 text-center py-4">
                      Tous les profils ont déjà ces points.
                    </p>
                  )}
                </div>
              </div>

              {/* Choix du statut */}
              <div className="mb-4">
                <p className="text-sm font-medium text-grey-700 mb-2">Statut des points copiés :</p>
                <div className="space-y-2">
                  <button
                    onClick={() => setTransferStatus('keep')}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      transferStatus === 'keep'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-grey-200 hover:border-grey-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      transferStatus === 'keep' ? 'border-primary-500' : 'border-grey-300'
                    }`}>
                      {transferStatus === 'keep' && (
                        <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                      )}
                    </div>
                    <span className={`font-medium ${transferStatus === 'keep' ? 'text-primary-700' : 'text-grey-700'}`}>
                      Garder le statut original
                    </span>
                  </button>
                  <button
                    onClick={() => setTransferStatus('to_select')}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      transferStatus === 'to_select'
                        ? 'border-warning-500 bg-warning-50'
                        : 'border-grey-200 hover:border-grey-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      transferStatus === 'to_select' ? 'border-warning-500' : 'border-grey-300'
                    }`}>
                      {transferStatus === 'to_select' && (
                        <div className="w-2 h-2 rounded-full bg-warning-500"></div>
                      )}
                    </div>
                    <span className={`font-medium ${transferStatus === 'to_select' ? 'text-warning-700' : 'text-grey-700'}`}>
                      À flasher
                    </span>
                  </button>
                  <button
                    onClick={() => setTransferStatus('selected')}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      transferStatus === 'selected'
                        ? 'border-success-500 bg-success-50'
                        : 'border-grey-200 hover:border-grey-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      transferStatus === 'selected' ? 'border-success-500' : 'border-grey-300'
                    }`}>
                      {transferStatus === 'selected' && (
                        <div className="w-2 h-2 rounded-full bg-success-500"></div>
                      )}
                    </div>
                    <span className={`font-medium ${transferStatus === 'selected' ? 'text-success-700' : 'text-grey-700'}`}>
                      Flashé
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer du modal */}
            <div className="p-4 border-t border-grey-100 flex gap-3">
              <button
                onClick={closeTransfertModal}
                className="flex-1 px-4 py-2 text-grey-600 bg-grey-100 hover:bg-grey-200 rounded-lg transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={copyPointsToProfile}
                disabled={!targetProfileId || transferLoading}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${
                  targetProfileId && !transferLoading
                    ? 'bg-primary-500 text-white hover:bg-primary-600'
                    : 'bg-grey-200 text-grey-400 cursor-not-allowed'
                }`}
              >
                {transferLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Copie en cours...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                    Copier
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { supabase } from '../services/supabaseClient';

export default function DataExport() {
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState(
    localStorage.getItem('lastExportDate')
  );

  const exportAllData = async () => {
    setExporting(true);

    try {
      // Récupérer tous les profils
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Récupérer tous les points
      const { data: pointsData, error: pointsError } = await supabase
        .from('points')
        .select('*');

      if (pointsError) throw pointsError;

      // Créer l'objet d'export
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        data: {
          profiles: profilesData || [],
          points: pointsData || [],
        },
        stats: {
          totalProfiles: profilesData?.length || 0,
          totalPoints: pointsData?.length || 0,
          pointsByProfile: (profilesData || []).map(profile => ({
            profileId: profile.id,
            profileName: profile.name,
            pointsCount: (pointsData || []).filter(p => p.profile_id === profile.id).length,
          })),
        },
      };

      // Créer et télécharger le fichier JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inviders-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Sauvegarder la date du dernier export
      const exportDate = new Date().toISOString();
      localStorage.setItem('lastExportDate', exportDate);
      setLastExport(exportDate);

    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      alert('Erreur lors de l\'export des données');
    } finally {
      setExporting(false);
    }
  };

  const exportAsCSV = async () => {
    setExporting(true);

    try {
      // Récupérer tous les points avec les infos des profils
      const { data: pointsData, error: pointsError } = await supabase
        .from('points')
        .select('*');

      if (pointsError) throw pointsError;

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*');

      // Créer un map des profils
      const profilesMap = new Map(
        (profilesData || []).map(p => [p.id, p.name])
      );

      // Créer le CSV
      const headers = ['Nom', 'Adresse', 'Latitude', 'Longitude', 'Points', 'Statut', 'Utilisateur', 'Date création'];
      const rows = (pointsData || []).map(point => [
        point.name || '',
        (point.address || '').replace(/,/g, ';'), // Remplacer les virgules
        point.latitude || '',
        point.longitude || '',
        point.points || 0,
        point.status === 'selected' ? 'Flashé' : 'À flasher',
        profilesMap.get(point.profile_id) || 'Inconnu',
        point.created_at ? new Date(point.created_at).toLocaleDateString('fr-FR') : '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      // Télécharger le CSV
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inviders-points-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Sauvegarder la date du dernier export
      const exportDate = new Date().toISOString();
      localStorage.setItem('lastExportDate', exportDate);
      setLastExport(exportDate);

    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
      alert('Erreur lors de l\'export CSV');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculer le nombre de jours depuis le dernier export
  const getDaysSinceLastExport = () => {
    if (!lastExport) return null;
    const lastDate = new Date(lastExport);
    const now = new Date();
    const diffTime = Math.abs(now - lastDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysSinceExport = getDaysSinceLastExport();
  const shouldRemind = daysSinceExport === null || daysSinceExport >= 7;

  return (
    <div className={`bg-white shadow-card p-6 ${shouldRemind ? 'ring-2 ring-amber-200' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-h2 text-grey-700 flex items-center gap-2">
            Sauvegarder mes données
            {shouldRemind && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                Recommandé
              </span>
            )}
          </h2>
          <p className="text-sm text-grey-500 mt-1">
            Exportez vos données localement pour garder une copie de sauvegarde.
          </p>
          {lastExport && (
            <p className="text-xs text-grey-400 mt-2">
              Dernier export : {formatDate(lastExport)}
              {daysSinceExport !== null && daysSinceExport > 0 && (
                <span className={daysSinceExport >= 7 ? 'text-amber-500' : ''}>
                  {' '}(il y a {daysSinceExport} jour{daysSinceExport > 1 ? 's' : ''})
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-row gap-2 w-full sm:w-auto">
          {/* Export JSON complet */}
          <button
            onClick={exportAllData}
            disabled={exporting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            Export JSON
          </button>

          {/* Export CSV */}
          <button
            onClick={exportAsCSV}
            disabled={exporting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-grey-100 hover:bg-grey-200 text-grey-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}

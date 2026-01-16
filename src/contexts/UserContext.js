import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

const UserContext = createContext();

// Profils par défaut (utilisés si la table n'existe pas encore)
const DEFAULT_PROFILES = [
  { id: 'default-1', name: 'Eva', initials: 'EV', color: '#EC4899' },
  { id: 'default-2', name: 'Niel', initials: 'NI', color: '#3B82F6' },
  { id: 'default-3', name: 'Clémentine', initials: 'CL', color: '#F59E0B' },
  { id: 'default-4', name: 'Grégory', initials: 'GR', color: '#22C55E' },
];

export function UserProvider({ children }) {
  const [profiles, setProfiles] = useState(DEFAULT_PROFILES);
  const [currentProfile, setCurrentProfile] = useState(
    DEFAULT_PROFILES.find(p => p.name === 'Clémentine') || DEFAULT_PROFILES[0]
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('name');

        if (error) {
          console.warn('Table profiles non trouvée, utilisation des profils par défaut:', error.message);
          // Garder les profils par défaut
          setLoading(false);
          return;
        }

        if (data && data.length > 0) {
          // Dédupliquer les profils par nom (garder le premier de chaque nom)
          const uniqueProfiles = data.filter((profile, index, self) =>
            index === self.findIndex(p => p.name === profile.name)
          );
          setProfiles(uniqueProfiles);

          // Sélectionner Clémentine par défaut ou le profil sauvegardé
          const savedProfileId = localStorage.getItem('currentProfileId');
          const savedProfile = uniqueProfiles.find(p => p.id === savedProfileId);
          const defaultProfile = uniqueProfiles.find(p => p.name === 'Clémentine');
          setCurrentProfile(savedProfile || defaultProfile || uniqueProfiles[0]);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des profils:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  const switchProfile = (profile) => {
    setCurrentProfile(profile);
    if (profile.id && !profile.id.startsWith('default-')) {
      localStorage.setItem('currentProfileId', profile.id);
    }
  };

  const updateProfile = async (profileId, updates) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', profileId);

      if (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        return false;
      }

      // Mettre à jour l'état local
      setProfiles(prev => prev.map(p =>
        p.id === profileId ? { ...p, ...updates } : p
      ));

      // Mettre à jour le profil courant si c'est celui qui est modifié
      if (currentProfile?.id === profileId) {
        setCurrentProfile(prev => ({ ...prev, ...updates }));
      }

      return true;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      return false;
    }
  };

  return (
    <UserContext.Provider value={{
      profiles,
      currentProfile,
      switchProfile,
      updateProfile,
      loading
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

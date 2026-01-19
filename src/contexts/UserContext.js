import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [profiles, setProfiles] = useState([]);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [credentialId, setCredentialId] = useState(() => localStorage.getItem('credentialId'));

  // Écouter les changements de localStorage (notamment après login)
  useEffect(() => {
    const handleStorageChange = () => {
      const newCredentialId = localStorage.getItem('credentialId');
      if (newCredentialId !== credentialId) {
        setCredentialId(newCredentialId);
      }
    };

    // Écouter les événements storage (pour les changements cross-tab)
    window.addEventListener('storage', handleStorageChange);

    // Vérifier périodiquement pour les changements dans le même tab
    // (storage event ne se déclenche pas pour le même tab)
    const interval = setInterval(handleStorageChange, 100);

    // Nettoyer après 5 secondes (suffisant pour capter le login)
    const timeout = setTimeout(() => clearInterval(interval), 5000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [credentialId]);

  // Charger les profils quand credentialId change
  useEffect(() => {
    const fetchProfiles = async () => {
      if (!credentialId) {
        setProfiles([]);
        setCurrentProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('credential_id', credentialId)
          .order('name');

        if (error) {
          console.warn('Erreur lors du chargement des profils:', error.message);
          setLoading(false);
          return;
        }

        if (data && data.length > 0) {
          setProfiles(data);

          // Sélectionner le profil sauvegardé ou le premier
          const savedProfileId = localStorage.getItem('currentProfileId');
          const savedProfile = data.find(p => p.id === savedProfileId);
          setCurrentProfile(savedProfile || data[0]);
        } else {
          setProfiles([]);
          setCurrentProfile(null);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des profils:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [credentialId]);

  const switchProfile = (profile) => {
    setCurrentProfile(profile);
    if (profile.id) {
      localStorage.setItem('currentProfileId', profile.id);
    }
  };

  const addProfile = async (name, initials, color) => {
    if (!credentialId) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([{
          credential_id: credentialId,
          name,
          initials,
          color
        }])
        .select()
        .single();

      if (error) {
        console.error('Erreur lors de la création du profil:', error);
        return null;
      }

      setProfiles(prev => [...prev, data]);

      // Si c'est le premier profil, le sélectionner automatiquement
      if (profiles.length === 0) {
        setCurrentProfile(data);
        localStorage.setItem('currentProfileId', data.id);
      }

      return data;
    } catch (error) {
      console.error('Erreur lors de la création du profil:', error);
      return null;
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

  const deleteProfile = async (profileId) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId);

      if (error) {
        console.error('Erreur lors de la suppression du profil:', error);
        return false;
      }

      setProfiles(prev => prev.filter(p => p.id !== profileId));

      // Si c'était le profil courant, en sélectionner un autre
      if (currentProfile?.id === profileId) {
        const remaining = profiles.filter(p => p.id !== profileId);
        setCurrentProfile(remaining[0] || null);
      }

      return true;
    } catch (error) {
      console.error('Erreur lors de la suppression du profil:', error);
      return false;
    }
  };

  return (
    <UserContext.Provider value={{
      profiles,
      currentProfile,
      credentialId,
      switchProfile,
      addProfile,
      updateProfile,
      deleteProfile,
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

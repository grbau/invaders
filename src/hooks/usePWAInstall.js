import { useState, useEffect } from 'react';

// Hook pour gérer l'installation PWA
// La bannière ne s'affichera que si showPrompt() est appelé
export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Intercepter l'événement beforeinstallprompt
    // Cela empêche la bannière automatique du navigateur
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      console.log('[PWA] Installation disponible - en attente de déclenchement manuel');
    };

    // Détecter si l'app est déjà installée
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      console.log('[PWA] Application installée avec succès');
    };

    // Vérifier si déjà en mode standalone (installé)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Fonction pour afficher la bannière d'installation
  const showPrompt = async () => {
    if (!installPrompt) {
      console.log('[PWA] Pas de prompt disponible');
      return false;
    }

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    console.log('[PWA] Choix utilisateur:', outcome);

    if (outcome === 'accepted') {
      setInstallPrompt(null);
      return true;
    }

    return false;
  };

  return {
    canInstall: !!installPrompt && !isInstalled,
    isInstalled,
    showPrompt
  };
}

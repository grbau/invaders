import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';

// Composant Avatar qui affiche la photo si elle existe, sinon les initiales
function ProfileAvatar({ profile, size = 'md' }) {
  const [hasImage, setHasImage] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Générer le chemin de l'image basé sur le nom du profil (en minuscules, sans accents)
  const getImagePath = (name) => {
    if (!name) return null;
    // Convertir en minuscules et retirer les accents
    const normalized = name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-');
    return `/users/${normalized}.jpg`;
  };

  const imagePath = getImagePath(profile?.name);
  const sizeClasses = size === 'md' ? 'w-10 h-10' : 'w-8 h-8';
  const textSize = size === 'md' ? 'font-medium' : 'text-sm font-medium';

  useEffect(() => {
    if (!imagePath) return;

    // Vérifier si l'image existe
    const img = new Image();
    img.onload = () => {
      setHasImage(true);
      setImageLoaded(true);
    };
    img.onerror = () => {
      setHasImage(false);
    };
    img.src = imagePath;
  }, [imagePath]);

  if (hasImage && imageLoaded) {
    return (
      <img
        src={imagePath}
        alt={profile?.name}
        className={`${sizeClasses} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} rounded-full flex items-center justify-center text-white ${textSize}`}
      style={{ backgroundColor: profile?.color || '#3B82F6' }}
    >
      {profile?.initials || '??'}
    </div>
  );
}

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { profiles, currentProfile, switchProfile, loading } = useUser();

  // Détecter le scroll pour changer le style du header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Bloquer le scroll du body quand le menu mobile est ouvert
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  if (loading) {
    return (
      <div className="min-h-screen bg-paris-background flex items-center justify-center">
        <div className="text-grey-500">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paris-background">
      {/* Header */}
      <header className="sticky top-0 z-50 shadow-md">
        {/* Background animé - slide de haut en bas pour scroll, de gauche pour menu mobile */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Background pour le scroll (haut en bas) */}
          <div
            className={`absolute inset-0 bg-white/95 backdrop-blur-sm transition-transform duration-300 ease-out ${
              isScrolled ? 'translate-y-0' : '-translate-y-full'
            }`}
          />
          {/* Background pour le menu mobile (gauche à droite) - uniquement sur mobile */}
          <div
            className={`md:hidden absolute inset-0 bg-white/95 backdrop-blur-sm transition-transform duration-300 ease-out ${
              mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img
                src="/logo-inviders.png"
                alt="Inviders"
                className="h-10 w-auto"
              />
              <span className="text-xl font-semibold text-grey-700">inviders baudic semete</span>
            </div>

            {/* Desktop User Selector */}
            <div className="hidden md:flex items-center gap-4 relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/50 transition-colors cursor-pointer"
              >
                <span className="text-sm text-grey-500">{currentProfile?.name || 'Sélectionner'}</span>
                <ProfileAvatar profile={currentProfile} size="md" />
                <svg className="w-4 h-4 text-grey-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown menu */}
              {profileMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white shadow-lg border border-grey-200 py-2" style={{ zIndex: 9999 }}>
                  {profiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => {
                        switchProfile(profile);
                        setProfileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-grey-50 transition-colors ${
                        currentProfile?.id === profile.id ? 'bg-primary-50' : ''
                      }`}
                    >
                      <ProfileAvatar profile={profile} size="sm" />
                      <span className="text-sm text-grey-700">{profile.name}</span>
                      {currentProfile?.id === profile.id && (
                        <svg className="w-4 h-4 text-primary-500 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}

                  {/* Séparateur */}
                  <div className="border-t border-grey-200 my-2" />

                  {/* Bouton de déconnexion */}
                  <button
                    onClick={() => {
                      localStorage.removeItem('sessionExpiresAt');
                      window.location.reload();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-red-50 transition-colors text-red-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="text-sm">Déconnexion</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-grey-500 hover:bg-grey-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

        </div>
      </header>

      {/* Mobile Menu - Position fixed avec transition smooth */}
      <div
        className={`md:hidden fixed top-16 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm shadow-lg border-t border-grey-100 transition-all duration-300 ease-out ${
          mobileMenuOpen
            ? 'opacity-100 translate-x-0'
            : 'opacity-0 -translate-x-full pointer-events-none'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-xs text-grey-400 uppercase tracking-wide px-2 mb-3">
            Changer de profil
          </div>
          <div className="space-y-1">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => {
                  switchProfile(profile);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-grey-50 transition-colors ${
                  currentProfile?.id === profile.id ? 'bg-primary-50' : ''
                }`}
              >
                <ProfileAvatar profile={profile} size="md" />
                <span className="text-sm text-grey-700">{profile.name}</span>
                {currentProfile?.id === profile.id && (
                  <svg className="w-4 h-4 text-primary-500 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Bouton de déconnexion mobile */}
          <div className="border-t border-grey-200 mt-4 pt-4">
            <button
              onClick={() => {
                localStorage.removeItem('sessionExpiresAt');
                window.location.reload();
              }}
              className="w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-red-50 transition-colors text-red-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-sm font-medium">Déconnexion</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overlay pour fermer le menu mobile */}
      <div
        className={`md:hidden fixed inset-0 top-16 z-30 bg-black/50 transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Click outside to close profile menu */}
      {profileMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setProfileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}

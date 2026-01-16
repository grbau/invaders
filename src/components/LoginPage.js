import { useState } from 'react';
import { supabase } from '../services/supabaseClient';

// Durée de session en millisecondes (1 jour)
const SESSION_DURATION = 24 * 60 * 60 * 1000;

// Fonction de hash SHA-256
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Vérifier les identifiants depuis la base de données
async function verifyCredentials(usernameHash, passwordHash) {
  const { data, error } = await supabase
    .from('app_credentials')
    .select('id')
    .eq('username_hash', usernameHash)
    .eq('password_hash', passwordHash)
    .single();

  if (error || !data) {
    return false;
  }
  return true;
}

export default function LoginPage({ onLogin }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Hasher les entrées utilisateur
      const usernameHash = await hashString(credentials.username);
      const passwordHash = await hashString(credentials.password);

      // Vérifier les identifiants dans la base de données
      const isValid = await verifyCredentials(usernameHash, passwordHash);

      if (isValid) {
        const expiresAt = Date.now() + SESSION_DURATION;
        localStorage.setItem('sessionExpiresAt', expiresAt.toString());
        onLogin();
      } else {
        setError('Identifiant ou mot de passe incorrect');
      }
    } catch (err) {
      setError('Erreur lors de la vérification');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/family.jpg)' }}
      />

      {/* Overlay sombre */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Formulaire */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white/95 backdrop-blur-sm shadow-2xl p-8 rounded-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src="/logo-invaders.png"
              alt="Invaders"
              className="h-16 w-auto mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-grey-700">Invaders Baudic Semete</h1>
            <p className="text-grey-500 mt-2">Connectez-vous pour accéder à l'application</p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Champ identifiant */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-grey-700 mb-2">
                Identifiant
              </label>
              <input
                type="text"
                id="username"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="Entrez votre identifiant"
                required
                autoComplete="username"
              />
            </div>

            {/* Champ mot de passe */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-grey-700 mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                id="password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="Entrez votre mot de passe"
                required
                autoComplete="current-password"
              />
            </div>

            {/* Message d'erreur */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </p>
              </div>
            )}

            {/* Bouton de connexion */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Connexion...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Se connecter
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-white/70 text-sm mt-6">
          Application familiale Baudic Semete
        </p>
      </div>
    </div>
  );
}

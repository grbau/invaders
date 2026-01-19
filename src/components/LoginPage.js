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
    .select('id, family_name')
    .eq('username_hash', usernameHash)
    .eq('password_hash', passwordHash)
    .single();

  if (error || !data) {
    return null;
  }
  return data;
}

// Vérifier si un identifiant existe déjà
async function checkUsernameExists(usernameHash) {
  const { data, error } = await supabase
    .from('app_credentials')
    .select('id')
    .eq('username_hash', usernameHash)
    .single();

  return !error && data;
}

// Créer un nouveau compte
async function createAccount(usernameHash, passwordHash, familyName) {
  const { data, error } = await supabase
    .from('app_credentials')
    .insert([{ username_hash: usernameHash, password_hash: passwordHash, family_name: familyName }])
    .select('id')
    .single();

  if (error) {
    console.error('Erreur création compte:', error);
    return null;
  }
  return data;
}

// Rechercher un compte par identifiant (pour récupération mot de passe)
async function findAccountByUsername(usernameHash) {
  const { data, error } = await supabase
    .from('app_credentials')
    .select('id, family_name')
    .eq('username_hash', usernameHash)
    .single();

  if (error || !data) {
    return null;
  }
  return data;
}

// Mettre à jour le mot de passe
async function updatePassword(accountId, newPasswordHash) {
  const { error } = await supabase
    .from('app_credentials')
    .update({ password_hash: newPasswordHash })
    .eq('id', accountId);

  return !error;
}

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login', 'register' ou 'forgot'
  const [credentials, setCredentials] = useState({ username: '', password: '', confirmPassword: '', familyName: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: identifiant, 2: vérification nom famille, 3: nouveau mdp
  const [foundAccount, setFoundAccount] = useState(null);

  const resetForm = () => {
    setCredentials({ username: '', password: '', confirmPassword: '', familyName: '' });
    setError('');
    setSuccess('');
    setForgotStep(1);
    setFoundAccount(null);
  };

  const switchMode = (newMode) => {
    resetForm();
    setMode(newMode);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const usernameHash = await hashString(credentials.username);
      const passwordHash = await hashString(credentials.password);
      const account = await verifyCredentials(usernameHash, passwordHash);

      if (account) {
        const expiresAt = Date.now() + SESSION_DURATION;
        localStorage.setItem('sessionExpiresAt', expiresAt.toString());
        localStorage.setItem('familyName', account.family_name || 'Invaders');
        localStorage.setItem('credentialId', account.id);
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

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    // Validation
    if (credentials.familyName.trim().length < 2) {
      setError('Le nom de famille doit contenir au moins 2 caractères');
      setIsLoading(false);
      return;
    }

    if (credentials.username.length < 3) {
      setError('L\'identifiant doit contenir au moins 3 caractères');
      setIsLoading(false);
      return;
    }

    if (credentials.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      setIsLoading(false);
      return;
    }

    if (credentials.password !== credentials.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setIsLoading(false);
      return;
    }

    try {
      const usernameHash = await hashString(credentials.username);
      const passwordHash = await hashString(credentials.password);

      // Vérifier si l'identifiant existe déjà
      const exists = await checkUsernameExists(usernameHash);
      if (exists) {
        setError('Cet identifiant est déjà utilisé');
        setIsLoading(false);
        return;
      }

      // Créer le compte
      const account = await createAccount(usernameHash, passwordHash, credentials.familyName.trim());
      if (account) {
        setSuccess('Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
        setCredentials({ username: '', password: '', confirmPassword: '', familyName: '' });
        // Basculer vers le formulaire de connexion après 2 secondes
        setTimeout(() => {
          switchMode('login');
        }, 2000);
      } else {
        setError('Erreur lors de la création du compte');
      }
    } catch (err) {
      setError('Erreur lors de la création du compte');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (forgotStep === 1) {
        // Étape 1: Vérifier que l'identifiant existe
        const usernameHash = await hashString(credentials.username);
        const account = await findAccountByUsername(usernameHash);

        if (account) {
          setFoundAccount({ ...account, usernameHash });
          setForgotStep(2);
        } else {
          setError('Aucun compte trouvé avec cet identifiant');
        }
      } else if (forgotStep === 2) {
        // Étape 2: Vérifier le nom de famille
        if (credentials.familyName.trim().toLowerCase() === foundAccount.family_name.toLowerCase()) {
          setForgotStep(3);
          setError('');
        } else {
          setError('Le nom de famille ne correspond pas');
        }
      } else if (forgotStep === 3) {
        // Étape 3: Réinitialiser le mot de passe
        if (credentials.password.length < 6) {
          setError('Le mot de passe doit contenir au moins 6 caractères');
          setIsLoading(false);
          return;
        }

        if (credentials.password !== credentials.confirmPassword) {
          setError('Les mots de passe ne correspondent pas');
          setIsLoading(false);
          return;
        }

        const newPasswordHash = await hashString(credentials.password);
        const updated = await updatePassword(foundAccount.id, newPasswordHash);

        if (updated) {
          setSuccess('Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter.');
          setTimeout(() => {
            switchMode('login');
          }, 2000);
        } else {
          setError('Erreur lors de la réinitialisation du mot de passe');
        }
      }
    } catch (err) {
      setError('Une erreur est survenue');
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
            <h1 className="text-2xl font-bold text-grey-700">
              {mode === 'login' && 'Invaders'}
              {mode === 'register' && 'Créer un compte'}
              {mode === 'forgot' && 'Mot de passe oublié'}
            </h1>
            <p className="text-grey-500 mt-2">
              {mode === 'login' && 'Connectez-vous pour accéder à l\'application'}
              {mode === 'register' && 'Rejoignez la communauté des chasseurs d\'Invaders'}
              {mode === 'forgot' && 'Réinitialisez votre mot de passe en 3 étapes'}
            </p>
          </div>

          {/* Formulaire de connexion */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6">
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

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </p>
                </div>
              )}

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

              {/* Lien mot de passe oublié */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-sm text-grey-500 hover:text-primary-600"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              {/* Lien vers inscription */}
              <div className="text-center pt-4 border-t border-grey-200">
                <p className="text-sm text-grey-500">
                  Pas encore de compte ?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Créer un compte
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* Formulaire mot de passe oublié */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              {/* Indicateur d'étapes */}
              <div className="flex items-center justify-center gap-2 mb-4">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      forgotStep >= step
                        ? 'bg-primary-500 text-white'
                        : 'bg-grey-200 text-grey-500'
                    }`}
                  >
                    {step}
                  </div>
                ))}
              </div>

              {/* Étape 1: Identifiant */}
              {forgotStep === 1 && (
                <div>
                  <label htmlFor="forgot-username" className="block text-sm font-medium text-grey-700 mb-2">
                    Votre identifiant
                  </label>
                  <input
                    type="text"
                    id="forgot-username"
                    value={credentials.username}
                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Entrez votre identifiant"
                    required
                    autoComplete="username"
                  />
                  <p className="mt-2 text-xs text-grey-400">
                    Entrez l'identifiant que vous avez utilisé lors de la création de votre compte.
                  </p>
                </div>
              )}

              {/* Étape 2: Vérification nom de famille */}
              {forgotStep === 2 && (
                <div>
                  <label htmlFor="forgot-family" className="block text-sm font-medium text-grey-700 mb-2">
                    Nom de famille
                  </label>
                  <input
                    type="text"
                    id="forgot-family"
                    value={credentials.familyName}
                    onChange={(e) => setCredentials({ ...credentials, familyName: e.target.value })}
                    className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="Entrez votre nom de famille"
                    required
                  />
                  <p className="mt-2 text-xs text-grey-400">
                    Pour vérifier votre identité, entrez le nom de famille associé à votre compte.
                  </p>
                </div>
              )}

              {/* Étape 3: Nouveau mot de passe */}
              {forgotStep === 3 && (
                <>
                  <div>
                    <label htmlFor="forgot-password" className="block text-sm font-medium text-grey-700 mb-2">
                      Nouveau mot de passe
                    </label>
                    <input
                      type="password"
                      id="forgot-password"
                      value={credentials.password}
                      onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                      className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                      placeholder="Choisissez un nouveau mot de passe"
                      required
                      autoComplete="new-password"
                      minLength={6}
                    />
                    <p className="mt-1 text-xs text-grey-400">Minimum 6 caractères</p>
                  </div>

                  <div>
                    <label htmlFor="forgot-confirm" className="block text-sm font-medium text-grey-700 mb-2">
                      Confirmer le mot de passe
                    </label>
                    <input
                      type="password"
                      id="forgot-confirm"
                      value={credentials.confirmPassword}
                      onChange={(e) => setCredentials({ ...credentials, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                      placeholder="Confirmez votre nouveau mot de passe"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </p>
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-600 flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {success}
                  </p>
                </div>
              )}

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
                    Vérification...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {forgotStep === 3 ? 'Réinitialiser le mot de passe' : 'Continuer'}
                  </>
                )}
              </button>

              {/* Lien retour connexion */}
              <div className="text-center pt-4 border-t border-grey-200">
                <p className="text-sm text-grey-500">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    ← Retour à la connexion
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* Formulaire d'inscription */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label htmlFor="reg-family" className="block text-sm font-medium text-grey-700 mb-2">
                  Nom de famille
                </label>
                <input
                  type="text"
                  id="reg-family"
                  value={credentials.familyName}
                  onChange={(e) => setCredentials({ ...credentials, familyName: e.target.value })}
                  className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="Ex: Dupont, Martin..."
                  required
                  autoComplete="family-name"
                  minLength={2}
                />
                <p className="mt-1 text-xs text-grey-400">Sera affiché dans l'application</p>
              </div>

              <div>
                <label htmlFor="reg-username" className="block text-sm font-medium text-grey-700 mb-2">
                  Identifiant
                </label>
                <input
                  type="text"
                  id="reg-username"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="Choisissez un identifiant"
                  required
                  autoComplete="username"
                  minLength={3}
                />
                <p className="mt-1 text-xs text-grey-400">Minimum 3 caractères</p>
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-grey-700 mb-2">
                  Mot de passe
                </label>
                <input
                  type="password"
                  id="reg-password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="Choisissez un mot de passe"
                  required
                  autoComplete="new-password"
                  minLength={6}
                />
                <p className="mt-1 text-xs text-grey-400">Minimum 6 caractères</p>
              </div>

              <div>
                <label htmlFor="reg-confirm" className="block text-sm font-medium text-grey-700 mb-2">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  id="reg-confirm"
                  value={credentials.confirmPassword}
                  onChange={(e) => setCredentials({ ...credentials, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="Confirmez votre mot de passe"
                  required
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </p>
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-600 flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {success}
                  </p>
                </div>
              )}

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
                    Création...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Créer mon compte
                  </>
                )}
              </button>

              {/* Lien vers connexion */}
              <div className="text-center pt-4 border-t border-grey-200">
                <p className="text-sm text-grey-500">
                  Déjà un compte ?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Se connecter
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-white/70 text-sm mt-6">
          Application familiale - Chasseurs d'Invaders
        </p>
      </div>
    </div>
  );
}

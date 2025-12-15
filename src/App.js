import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import MapView from './components/MapView';
import PointsList from './components/PointsList';
import PointForm from './components/PointForm';
import LoginPage from './components/LoginPage';
import { usePWAInstall } from './hooks/usePWAInstall';

function App() {
  const [filter, setFilter] = useState('all');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { canInstall, showPrompt } = usePWAInstall();

  // Vérifier si l'utilisateur est déjà connecté
  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated');
    setIsAuthenticated(authStatus === 'true');
    setCheckingAuth(false);
  }, []);

  // Afficher un écran de chargement pendant la vérification
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-grey-100 flex items-center justify-center">
        <div className="text-grey-500">Chargement...</div>
      </div>
    );
  }

  // Afficher la page de connexion si non authentifié
  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Desktop: Liste et Carte côte à côte */}
        {/* Mobile: empilé (Liste -> Carte) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Liste des points */}
          <div className="order-1 h-[400px] lg:h-[560px]">
            <PointsList filter={filter} setFilter={setFilter} />
          </div>

          {/* Carte */}
          <div className="order-2 h-[400px] lg:h-[560px]">
            <div className="bg-white shadow-card overflow-hidden h-full flex flex-col">
              <div className="bg-primary-500 text-white px-4 py-3 font-medium">
                Carte
              </div>
              <div className="flex-1">
                <MapView filter={filter} />
              </div>
            </div>
          </div>
        </div>

        {/* Formulaire en dessous - sur une ligne */}
        <div className="bg-white shadow-card p-6">
          <h2 className="text-h2 text-grey-700 mb-6">Ajouter un point</h2>
          <PointForm />
        </div>

        {/* Bouton d'installation PWA - visible uniquement si disponible */}
        {canInstall && (
          <div className="fixed bottom-4 right-4 z-50">
            <button
              onClick={showPrompt}
              className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Installer l'app
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default App;
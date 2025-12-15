import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { UserProvider } from './contexts/UserContext';
import { PointsProvider } from './contexts/PointsContext';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <UserProvider>
      <PointsProvider>
        <App />
      </PointsProvider>
    </UserProvider>
  </React.StrictMode>
);

// Register Service Worker for PWA support
serviceWorkerRegistration.register({
  onSuccess: () => {
    console.log('[Inviders] App ready for offline use!');
  },
  onUpdate: (registration) => {
    console.log('[Inviders] New version available! Refresh to update.');
    // Optional: Show a notification to the user
    if (window.confirm('Une nouvelle version est disponible. Voulez-vous rafraichir?')) {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
    }
  }
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

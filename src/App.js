import { useState, useCallback } from 'react';
import MapView from './components/MapView';
import PointForm from './components/PointForm';
import Filters from './components/Filters';
import PointsList from './components/PointsList';

function App() {
  const [filter, setFilter] = useState('all');
  const refreshKey = useState(0);
  const [, setKey] = refreshKey;
  const triggerRefresh = useCallback(() => setKey(k => k + 1), []);

  return (
    <div>
      <h1>Carte interactive des points</h1>
      <Filters filter={filter} setFilter={setFilter} />
      <PointForm onAdded={triggerRefresh} />
      <PointsList filter={filter} />
      <MapView filter={filter} refreshKey={refreshKey[0]} />
    </div>
  );
}

export default App;
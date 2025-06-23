export default function Filters({ filter, setFilter }) {
  return (
    <div>
      <button onClick={() => setFilter('all')} disabled={filter === 'all'}>Tous</button>
      <button onClick={() => setFilter('selected')} disabled={filter === 'selected'}>Sélectionnés</button>
      <button onClick={() => setFilter('to_select')} disabled={filter === 'to_select'}>À sélectionner</button>
    </div>
  );
}
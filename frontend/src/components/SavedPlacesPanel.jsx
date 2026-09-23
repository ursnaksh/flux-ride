import { useState } from 'react';
import { removeSavedPlace, savePlace } from '../utils/savedPlaces';

function defaultName(point, fallback) {
  if (!point?.label) return fallback;
  const first = point.label.split(',')[0]?.trim();
  return first?.slice(0, 24) || fallback;
}

export default function SavedPlacesPanel({
  pickup,
  destination,
  savedPlaces,
  onPlacesChange,
  onUsePickup,
  onUseDestination
}) {
  const [saving, setSaving] = useState(null);
  const [name, setName] = useState('');

  function startSave(kind) {
    const point = kind === 'pickup' ? pickup : destination;
    if (!point) return;
    setSaving(kind);
    setName(defaultName(point, kind === 'pickup' ? 'Home' : 'College'));
  }

  function commitSave(event) {
    event.preventDefault();
    const point = saving === 'pickup' ? pickup : destination;
    if (!point || !name.trim()) return;
    const next = savePlace({
      name: name.trim(),
      label: point.label,
      lat: point.lat,
      lng: point.lng
    });
    onPlacesChange(next);
    setSaving(null);
    setName('');
  }

  function remove(id) {
    onPlacesChange(removeSavedPlace(id));
  }

  return <section className="saved-places-panel">
    <div className="saved-places-head">
      <div>
        <p className="eyebrow">QUICK PLACES</p>
        <strong>Saved places</strong>
      </div>
      <div className="saved-place-save-actions">
        {pickup && <button type="button" onClick={() => startSave('pickup')}>+ Save pickup</button>}
        {destination && <button type="button" onClick={() => startSave('destination')}>+ Save destination</button>}
      </div>
    </div>

    {saving && <form className="saved-place-form" onSubmit={commitSave}>
      <input
        autoFocus
        value={name}
        maxLength="30"
        onChange={event => setName(event.target.value)}
        placeholder="Name it Home, College…"
      />
      <button className="btn btn-primary">Save</button>
      <button type="button" className="btn btn-ghost" onClick={() => setSaving(null)}>Cancel</button>
    </form>}

    {savedPlaces.length ? <div className="saved-place-list">
      {savedPlaces.map(place => <article className="saved-place-chip" key={place.id}>
        <div>
          <strong>{place.name}</strong>
          <span>{place.label}</span>
        </div>
        <div className="saved-place-chip-actions">
          <button type="button" onClick={() => onUsePickup(place)}>From</button>
          <button type="button" onClick={() => onUseDestination(place)}>To</button>
          <button type="button" className="saved-place-remove" onClick={() => remove(place.id)} aria-label={\`Remove \${place.name}\`}>×</button>
        </div>
      </article>)}
    </div> : <p className="saved-place-empty">Save Home, College, Hostel or Station once — then reuse them in one tap.</p>}
  </section>;
}

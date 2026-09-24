import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import RideChat from './RideChat';
import { formatDeparture, money } from '../utils/trips';

export default function PoolCard({ pool, onPoolChange }) {
  const [snapshot, setSnapshot] = useState(pool);
  const [readyBusy, setReadyBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const members = snapshot?.members || [];
  const perMember = members.length ? snapshot.totalFare / members.length : snapshot.totalFare;
  const userId = Number(localStorage.getItem('flux_user_id'));
  const currentMember = members.find(member => Number(member.userId) === userId);

  useEffect(() => setSnapshot(pool), [pool]);

  async function toggleReady() {
    if (!currentMember || readyBusy) return;

    setReadyBusy(true);
    setActionError('');

    try {
      const response = await axiosClient.post(
        `/api/pools/${snapshot.id}/ready/${userId}?ready=${!currentMember.ready}`
      );
      setSnapshot(response.data);
      onPoolChange?.(response.data);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setReadyBusy(false);
    }
  }

  const readyCount = members.filter(member => member.ready).length;

  return <article className="card shared-card">
    <div className="card-row">
      <div>
        <p className="eyebrow">SHARED TRIP #{snapshot.id}</p>
        <h3>To {snapshot.destinationLabel}</h3>
      </div>
      <span className={`status-badge status-${snapshot.status?.toLowerCase()}`}>
        {snapshot.status?.replaceAll('_', ' ')}
      </span>
    </div>

    <p className="departure-line">
      {formatDeparture(snapshot.departureTime)}
      <span> · {members.length}/4 passengers</span>
    </p>

    <ul className="member-list">
      {members.map((member, index) => <li key={member.id || member.userId}>
        <span className={`member-avatar avatar-tone-${index % 3}`} aria-hidden="true">
          {member.initials || member.userName?.slice(0, 1)}
        </span>
        <div className="member-copy">
          <div className="member-name-row">
            <strong>
              {Number(member.userId) === userId ? `${member.userName} (You)` : member.userName}
              {member.verified && <span className="member-verified-badge" title="Phone verified" aria-label="Phone verified">✓ Verified</span>}
            </strong>
            <span className={`ready-pill ${member.ready ? 'is-ready' : ''}`}>
              {member.ready ? 'Ready' : 'Not ready'}
            </span>
          </div>
          <span>{member.pickup}</span>
        </div>
      </li>)}
    </ul>

    <div className="fare-row">
      <span>Estimated share per person</span>
      <strong>{money(perMember)}</strong>
    </div>

    {members.length > 1 && <section className="ready-panel">
      <div>
        <p className="eyebrow">READY CHECK</p>
        <strong>{readyCount}/{members.length} passengers ready</strong>
        <p>{snapshot.status === 'READY'
          ? 'Everyone is ready. Coordinate the booking in chat.'
          : 'Confirm when you are ready to leave.'}</p>
      </div>
      {currentMember && <button
        className={`btn ${currentMember.ready ? 'btn-ghost' : 'btn-primary'}`}
        onClick={toggleReady}
        disabled={readyBusy}
      >
        {readyBusy ? 'Updating…' : currentMember.ready ? 'Mark not ready' : 'I’m ready'}
      </button>}
    </section>}

    {actionError && <p className="form-error">{actionError}</p>}

    {members.length > 1 && <RideChat
      groupId={snapshot.id}
      members={members}
    />}

    <p className="quiet-note">
      Coordinate here, then book your Uber, Ola, cab or auto separately. Joining FLUX RIDE does not book transport or automatically reveal private contact details.
    </p>
  </article>;
}

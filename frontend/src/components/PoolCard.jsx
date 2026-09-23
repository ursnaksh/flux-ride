import { useEffect, useRef, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { formatDeparture, money } from '../utils/trips';

export default function PoolCard({ pool, onPoolChange }) {
  const [snapshot, setSnapshot] = useState(pool);
  const members = snapshot?.members || [];
  const perMember = members.length ? snapshot.totalFare / members.length : snapshot.totalFare;
  const userId = Number(localStorage.getItem('flux_user_id'));
  const currentMember = members.find(member => Number(member.userId) === userId);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [chatError, setChatError] = useState('');
  const [readyBusy, setReadyBusy] = useState(false);
  const previousMessageCount = useRef(null);

  useEffect(() => setSnapshot(pool), [pool]);

  async function loadMessages() {
    if (!snapshot?.id || !userId) return;
    try {
      const response = await axiosClient.get(`/api/pools/${snapshot.id}/messages?userId=${userId}`);
      const next = response.data || [];

      if (
        previousMessageCount.current != null
        && next.length > previousMessageCount.current
        && document.hidden
        && 'Notification' in window
        && Notification.permission === 'granted'
      ) {
        const latest = next[next.length - 1];
        if (latest && Number(latest.userId) !== userId) {
          new Notification('New FLUX RIDE message', {
            body: `${latest.userName}: ${latest.message}`
          });
        }
      }

      previousMessageCount.current = next.length;
      setMessages(next);
      setChatError('');
    } catch (err) {
      setChatError(err.message);
    }
  }

  useEffect(() => {
    previousMessageCount.current = null;
    loadMessages();
    const timer = window.setInterval(loadMessages, 4000);
    return () => window.clearInterval(timer);
  }, [snapshot?.id, userId]);

  async function sendMessage(event) {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    try {
      await axiosClient.post(`/api/pools/${snapshot.id}/messages`, { userId, message });
      setText('');
      await loadMessages();
    } catch (err) {
      setChatError(err.message);
    }
  }

  async function toggleReady() {
    if (!currentMember || readyBusy) return;
    setReadyBusy(true);
    try {
      const response = await axiosClient.post(
        `/api/pools/${snapshot.id}/ready/${userId}?ready=${!currentMember.ready}`
      );
      setSnapshot(response.data);
      onPoolChange?.(response.data);
    } catch (err) {
      setChatError(err.message);
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
            <strong>{Number(member.userId) === userId ? `${member.userName} (You)` : member.userName}</strong>
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
      {currentMember && <button className={`btn ${currentMember.ready ? 'btn-ghost' : 'btn-primary'}`} onClick={toggleReady} disabled={readyBusy}>
        {readyBusy ? 'Updating…' : currentMember.ready ? 'Mark not ready' : 'I’m ready'}
      </button>}
    </section>}

    {members.length > 1 && <section className="group-chat">
      <p className="eyebrow">GROUP ROOM</p>
      <h3>Coordinate your ride</h3>
      <div className="chat-messages" aria-live="polite">
        {messages.length ? messages.map(item => <div className={`chat-message ${item.userId === userId ? 'chat-message-mine' : ''}`} key={item.id}>
          <strong>{item.userId === userId ? 'You' : item.userName}</strong>
          <span>{item.message}</span>
        </div>) : <p className="quiet-note">No messages yet. Say hello and decide where to meet.</p>}
      </div>
      {chatError && <p className="form-error">{chatError}</p>}
      <form className="chat-compose" onSubmit={sendMessage}>
        <input value={text} onChange={event => setText(event.target.value)} maxLength="500" placeholder="Message your group…" aria-label="Group message" />
        <button className="btn btn-primary" disabled={!text.trim()}>Send</button>
      </form>
    </section>}

    <p className="quiet-note">Coordinate here, then book your Uber, Ola, cab or auto separately. Joining FLUX RIDE does not book transport or automatically reveal private contact details.</p>
  </article>;
}

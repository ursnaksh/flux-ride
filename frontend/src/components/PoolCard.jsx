import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { formatDeparture, money } from '../utils/trips';

export default function PoolCard({ pool }) {
  const members = pool.members || [];
  const perMember = members.length ? pool.totalFare / members.length : pool.totalFare;
  const userId = Number(localStorage.getItem('flux_user_id'));
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [chatError, setChatError] = useState('');

  async function loadMessages() {
    if (!pool.id || !userId) return;
    try {
      const response = await axiosClient.get(`/api/pools/${pool.id}/messages?userId=${userId}`);
      setMessages(response.data || []);
      setChatError('');
    } catch (err) { setChatError(err.message); }
  }

  useEffect(() => {
    loadMessages();
    const timer = window.setInterval(loadMessages, 4000);
    return () => window.clearInterval(timer);
  }, [pool.id, userId]);

  async function sendMessage(event) {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    try {
      await axiosClient.post(`/api/pools/${pool.id}/messages`, { userId, message });
      setText('');
      await loadMessages();
    } catch (err) { setChatError(err.message); }
  }

  return <article className="card shared-card">
    <div className="card-row"><div><p className="eyebrow">SHARED TRIP #{pool.id}</p><h3>To {pool.destinationLabel}</h3></div>
      <span className={`status-badge status-${pool.status?.toLowerCase()}`}>{pool.status?.replaceAll('_', ' ')}</span></div>
    <p className="departure-line">{formatDeparture(pool.departureTime)} <span>· {members.length}/4 passengers</span></p>
    <ul className="member-list">{members.map((member, index) => <li key={member.id || member.userId}>
      <span className={`member-avatar avatar-tone-${index % 3}`} aria-hidden="true">{member.initials || member.userName?.slice(0, 1)}</span>
      <div><strong>{member.userName}</strong><span>{member.pickup}</span></div>
    </li>)}</ul>
    <div className="fare-row"><span>Estimated share per person</span><strong>{money(perMember)}</strong></div>

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
        <input value={text} onChange={e => setText(e.target.value)} maxLength="500" placeholder="Message your group…" aria-label="Group message" />
        <button className="btn btn-primary" disabled={!text.trim()}>Send</button>
      </form>
    </section>}

    <p className="quiet-note">Coordinate here, then book your Uber, Ola, cab or auto separately. Joining FLUX RIDE does not book transport or automatically reveal private contact details.</p>
  </article>;
}

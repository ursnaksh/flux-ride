import { useEffect, useMemo, useRef, useState } from 'react';
import useRideChat from '../hooks/useRideChat';

const QUICK_MESSAGES = [
  'I’m leaving now',
  '5 min away',
  'Reached pickup',
  'Book the cab?'
];

function dayLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();

  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short'
  });
}

function timeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
}

export default function RideChat({
  groupId,
  members = [],
  compact = false,
  autoFocus = false
}) {
  const userId = Number(localStorage.getItem('flux_user_id'));
  const [text, setText] = useState('');
  const [newMessages, setNewMessages] = useState(0);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const atBottom = useRef(true);
  const typingStopTimer = useRef(null);
  const previousMessageCount = useRef(0);

  const {
    messages,
    socketState,
    onlineUsers,
    typingUsers,
    chatError,
    sending,
    sendMessage,
    sendTyping
  } = useRideChat(groupId, userId);

  const onlineIds = useMemo(
    () => new Set(onlineUsers.map(item => Number(item.userId))),
    [onlineUsers]
  );

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const area = scrollRef.current;
    if (!area) return;

    const added = Math.max(0, messages.length - previousMessageCount.current);
    const latest = messages[messages.length - 1];
    const mine = Number(latest?.userId) === userId;

    if (atBottom.current || mine || previousMessageCount.current === 0) {
      requestAnimationFrame(() => {
        area.scrollTop = area.scrollHeight;
        atBottom.current = true;
        setNewMessages(0);
      });
    } else if (added > 0) {
      setNewMessages(count => count + added);
    }

    previousMessageCount.current = messages.length;
  }, [messages, userId]);

  useEffect(() => () => {
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    sendTyping(false);
  }, []);

  function handleScroll() {
    const area = scrollRef.current;
    if (!area) return;

    const distance = area.scrollHeight - area.scrollTop - area.clientHeight;
    atBottom.current = distance < 70;
    if (atBottom.current) setNewMessages(0);
  }

  function handleTextChange(event) {
    const value = event.target.value;
    setText(value);

    sendTyping(Boolean(value.trim()));
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    typingStopTimer.current = window.setTimeout(() => sendTyping(false), 1200);
  }

  async function submit(event) {
    event?.preventDefault();
    const clean = text.trim();
    if (!clean || sending) return;

    try {
      await sendMessage(clean);
      setText('');
      sendTyping(false);
      if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
      textareaRef.current?.focus();
    } catch (_) {
      // Hook already exposes a user-visible error.
    }
  }

  async function sendQuick(message) {
    if (sending) return;
    try {
      await sendMessage(message);
    } catch (_) {
      // Hook already exposes a user-visible error.
    }
  }

  function keyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function jumpToLatest() {
    const area = scrollRef.current;
    if (!area) return;
    area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
    atBottom.current = true;
    setNewMessages(0);
  }

  let previousDay = '';

  return <section className={`ride-chat ${compact ? 'ride-chat-compact' : ''}`}>
    <header className="ride-chat-head">
      <div>
        <div className="ride-chat-title-row">
          <h3>Ride chat</h3>
          <span className={`chat-connection chat-${socketState}`}>
            <i></i>
            {socketState === 'connected' ? 'Live' : 'Connecting'}
          </span>
        </div>
        <p>
          {onlineUsers.length
            ? `${onlineUsers.length} online now`
            : `${members.length || 1} passenger${members.length === 1 ? '' : 's'} in this ride`}
        </p>
      </div>

      <div className="chat-presence-stack" aria-label="Online passengers">
        {members.slice(0, 4).map((member, index) =>
          <span
            key={member.id || member.userId}
            className={onlineIds.has(Number(member.userId)) ? 'is-online' : ''}
            title={`${member.userName}${onlineIds.has(Number(member.userId)) ? ' · online' : ''}`}
          >
            {member.initials || member.userName?.slice(0, 1)}
            <i></i>
          </span>
        )}
      </div>
    </header>

    <div className="chat-quick-row" aria-label="Quick messages">
      {QUICK_MESSAGES.map(message =>
        <button type="button" key={message} onClick={() => sendQuick(message)} disabled={sending}>
          {message}
        </button>
      )}
    </div>

    <div className="ride-chat-scroll-wrap">
      <div
        className="chat-messages ride-chat-messages"
        ref={scrollRef}
        onScroll={handleScroll}
        aria-live="polite"
      >
        {messages.length ? messages.map(item => {
          const currentDay = dayLabel(item.createdAt);
          const showDay = currentDay !== previousDay;
          previousDay = currentDay;

          const mine = Number(item.userId) === userId;

          return <div className="chat-message-block" key={item.id}>
            {showDay && <div className="chat-day-separator"><span>{currentDay}</span></div>}
            <div className={`chat-message ${mine ? 'chat-message-mine' : ''}`}>
              {!mine && <strong>{item.userName}</strong>}
              <span>{item.message}</span>
              <small>{timeLabel(item.createdAt)}{mine ? ' · Sent' : ''}</small>
            </div>
          </div>;
        }) : <div className="chat-empty-friendly">
          <span>✦</span>
          <strong>Start the coordination.</strong>
          <p>Say hello, confirm timing, then decide where to meet.</p>
        </div>}
      </div>

      {newMessages > 0 && <button type="button" className="chat-new-button" onClick={jumpToLatest}>
        {newMessages} new {newMessages === 1 ? 'message' : 'messages'} ↓
      </button>}
    </div>

    <div className="chat-typing-row" aria-live="polite">
      {typingUsers.length > 0
        ? <span><i></i><i></i><i></i> {typingUsers.map(item => item.userName).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…</span>
        : <span className="chat-typing-placeholder">Messages are visible only to this ride group.</span>}
    </div>

    {chatError && <div className="chat-inline-error" role="alert">
      <span>!</span>
      <p>{chatError}</p>
    </div>}

    <form className="chat-compose ride-chat-compose" onSubmit={submit}>
      <textarea
        ref={textareaRef}
        rows="1"
        value={text}
        onChange={handleTextChange}
        onKeyDown={keyDown}
        maxLength="500"
        placeholder="Message your ride…"
        aria-label="Ride message"
      />
      <button className="btn btn-primary chat-send-button" disabled={!text.trim() || sending}>
        {sending ? '…' : 'Send'}
      </button>
    </form>

    <p className="chat-compose-hint">Enter to send · Shift + Enter for a new line</p>
  </section>;
}

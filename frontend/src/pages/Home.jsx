import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import RideChat from '../components/RideChat';
import { formatDeparture } from '../utils/trips';

const COMMUTE_KEY = 'flux_daily_commute';

function loadCommute() {
  try {
    return JSON.parse(localStorage.getItem(COMMUTE_KEY) || 'null');
  } catch (_) {
    return null;
  }
}

function shortPlace(label) {
  if (!label) return 'Saved place';
  return label.split(',').slice(0, 2).join(',').trim();
}

function countdownLabel(departureTime, now = Date.now()) {
  if (!departureTime) return 'Departure time pending';
  const diff = new Date(departureTime).getTime() - now;
  if (!Number.isFinite(diff)) return formatDeparture(departureTime);
  if (diff <= 0) return 'Departure time reached';

  const mins = Math.ceil(diff / 60000);
  if (mins < 60) return `Leaving in ${mins} min`;

  const hours = Math.floor(mins / 60);
  const left = mins % 60;
  if (hours < 24) return `Leaving in ${hours}h ${left}m`;

  const days = Math.floor(hours / 24);
  return `Leaving in ${days}d ${hours % 24}h`;
}

function chooseActiveMatch(groups = []) {
  const active = groups
    .filter(group =>
      (group.members?.length || 0) > 1
      && !['COMPLETED', 'CANCELLED'].includes(group.status)
    )
    .sort((a, b) => {
      const aTime = new Date(a.departureTime || 0).getTime();
      const bTime = new Date(b.departureTime || 0).getTime();
      return aTime - bTime;
    });

  return active[0] || null;
}

export default function Home() {
  const [count, setCount] = useState(null);
  const [commute, setCommute] = useState(loadCommute);
  const [activeMatch, setActiveMatch] = useState(null);
  const [liveLocations, setLiveLocations] = useState([]);
  const [liveSharing, setLiveSharing] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [readyBusy, setReadyBusy] = useState(false);
  const [copyState, setCopyState] = useState('');
  const [now, setNow] = useState(Date.now());
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const [matchFlash, setMatchFlash] = useState(
    () => sessionStorage.getItem('flux_match_flash') === '1'
  );
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [latestChatId, setLatestChatId] = useState(null);

  const liveWatch = useRef(null);
  const lastLiveSentAt = useRef(0);

  const name = localStorage.getItem('flux_user_name') || 'there';
  const userId = Number(localStorage.getItem('flux_user_id'));
  const studentVerified =
    localStorage.getItem('flux_student_verified') === 'true';

  useEffect(() => {
    const controller = new AbortController();
    axiosClient.get('/api/pools/active/count', { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setCount(response.data); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;

    async function loadGroups() {
      try {
        const response = await axiosClient.get(`/api/pools/user/${userId}`);
        if (!alive) return;
        setActiveMatch(chooseActiveMatch(response.data || []));
      } catch (_) {
        if (alive) setActiveMatch(null);
      }
    }

    loadGroups();
    const timer = window.setInterval(loadGroups, 5000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [userId]);

  useEffect(() => {
    if (!activeMatch?.id || !userId) {
      setLiveLocations([]);
      return undefined;
    }

    let alive = true;

    async function loadLive() {
      try {
        const response = await axiosClient.get(
          `/api/pools/${activeMatch.id}/live-locations?userId=${userId}`
        );
        if (alive) setLiveLocations(response.data || []);
      } catch (_) {
        if (alive) setLiveLocations([]);
      }
    }

    loadLive();
    const timer = window.setInterval(loadLive, 5000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [activeMatch?.id, userId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!matchFlash) return undefined;
    sessionStorage.removeItem('flux_match_flash');
    const timer = window.setTimeout(() => setMatchFlash(false), 5000);
    return () => window.clearTimeout(timer);
  }, [matchFlash]);

  useEffect(() => {
    if (!activeMatch?.id || !userId) {
      setChatUnread(0);
      setLatestChatId(null);
      return undefined;
    }

    let alive = true;
    const readKey = `flux_chat_read_${activeMatch.id}_${userId}`;

    async function checkChat() {
      try {
        const response = await axiosClient.get(
          `/api/pools/${activeMatch.id}/messages?userId=${userId}`
        );
        if (!alive) return;

        const items = response.data || [];
        const latest = items[items.length - 1];
        const latestId = Number(latest?.id || 0);
        setLatestChatId(latestId || null);

        if (chatOpen) {
          if (latestId) localStorage.setItem(readKey, String(latestId));
          setChatUnread(0);
          return;
        }

        const lastRead = Number(localStorage.getItem(readKey) || 0);
        const unread = items.filter(item =>
          Number(item.id) > lastRead
          && Number(item.userId) !== userId
        ).length;
        setChatUnread(unread);
      } catch (_) {
        // Chat itself still has its own connection + REST fallback.
      }
    }

    checkChat();
    const timer = window.setInterval(checkChat, 10000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [activeMatch?.id, userId, chatOpen]);

  useEffect(() => {
    if (!chatOpen || !activeMatch?.id || !latestChatId) return;
    localStorage.setItem(
      `flux_chat_read_${activeMatch.id}_${userId}`,
      String(latestChatId)
    );
    setChatUnread(0);
  }, [chatOpen, activeMatch?.id, latestChatId, userId]);

  useEffect(() => () => {
    if (liveWatch.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(liveWatch.current);
      liveWatch.current = null;
    }
  }, []);

  const members = activeMatch?.members || [];
  const currentMember = members.find(member => Number(member.userId) === userId);
  const readyCount = members.filter(member => member.ready).length;
  const otherMembers = members.filter(member => Number(member.userId) !== userId);

  const matchTitle = useMemo(() => {
    if (!otherMembers.length) return 'Your group';
    if (otherMembers.length === 1) return `Matched with ${otherMembers[0].userName}`;
    return `Matched with ${otherMembers[0].userName} + ${otherMembers.length - 1}`;
  }, [otherMembers]);

  function clearCommute() {
    localStorage.removeItem(COMMUTE_KEY);
    setCommute(null);
  }

  async function toggleReady() {
    if (!activeMatch || !currentMember || readyBusy) return;

    setReadyBusy(true);
    try {
      const response = await axiosClient.post(
        `/api/pools/${activeMatch.id}/ready/${userId}?ready=${!currentMember.ready}`
      );
      setActiveMatch(response.data);
    } catch (_) {
      // Group polling will retry and keep the latest server state.
    } finally {
      setReadyBusy(false);
    }
  }

  function startLiveLocation() {
    if (!activeMatch || !navigator.geolocation || liveWatch.current != null) {
      if (!navigator.geolocation) {
        setLiveError('Live location is not supported by this browser.');
      }
      return;
    }

    setLiveError('');

    liveWatch.current = navigator.geolocation.watchPosition(
      async position => {
        const nowMs = Date.now();
        if (nowMs - lastLiveSentAt.current < 8000) return;
        lastLiveSentAt.current = nowMs;

        try {
          await axiosClient.post(
            `/api/pools/${activeMatch.id}/location/${userId}`,
            {
              sharing: true,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }
          );
          setLiveSharing(true);
          setLiveError('');
        } catch (err) {
          setLiveError(err.message);
        }
      },
      error => {
        setLiveSharing(false);
        setLiveError(
          error.code === 1
            ? 'Location permission was denied. Allow location access in your browser to share live.'
            : 'Your live location could not be read right now.'
        );
        if (liveWatch.current != null) {
          navigator.geolocation.clearWatch(liveWatch.current);
          liveWatch.current = null;
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );
  }

  async function stopLiveLocation() {
    if (!activeMatch) return;

    if (liveWatch.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(liveWatch.current);
      liveWatch.current = null;
    }

    setLiveSharing(false);
    lastLiveSentAt.current = 0;

    try {
      await axiosClient.post(
        `/api/pools/${activeMatch.id}/location/${userId}`,
        { sharing: false, latitude: null, longitude: null }
      );
      setLiveLocations(current =>
        current.filter(item => Number(item.userId) !== userId)
      );
      setLiveError('');
    } catch (err) {
      setLiveError(err.message);
    }
  }

  async function copyInvite() {
    if (!activeMatch) return;

    const link = `${window.location.origin}/invite/${activeMatch.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopyState('Copied');
      window.setTimeout(() => setCopyState(''), 1600);
    } catch (_) {
      setCopyState('Copy unavailable');
    }
  }

  async function enableNotifications() {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  return <div className="home-page flux-home-next">
    {matchFlash && activeMatch && <div className="home-match-flash" role="status">
      <span>✓</span>
      <div>
        <strong>You’re matched.</strong>
        <small>Your ride is now on Home — everything you need is below.</small>
      </div>
    </div>}

    {!studentVerified && <Link to="/profile" className="home-trust-nudge">
      <span>V</span>
      <div>
        <strong>Verify your VIT student profile</strong>
        <small>Add a student badge so co-passengers know you belong to the campus community.</small>
      </div>
      <b>Verify →</b>
    </Link>}

    {activeMatch && <section className="home-match-hub">
      <div className="home-match-glow" aria-hidden="true"></div>

      <div className="home-match-top">
        <div>
          <div className="home-match-live-pill">
            <span></span>
            ACTIVE MATCH
          </div>
          <p className="eyebrow">YOUR RIDE IS NOW ON HOME</p>
          <h1>{matchTitle}</h1>
          <p className="home-match-route">
            <span>→</span>
            {activeMatch.destinationLabel}
          </p>
        </div>

        <div className="home-match-countdown">
          <small>{formatDeparture(activeMatch.departureTime)}</small>
          <strong>{countdownLabel(activeMatch.departureTime, now)}</strong>
          <span>{activeMatch.status?.replaceAll('_', ' ')}</span>
        </div>
      </div>

      <div className="home-match-members">
        {members.map((member, index) => <div className="home-match-member" key={member.id || member.userId}>
          <span className={`home-match-avatar avatar-tone-${index % 3}`}>
            {member.initials || member.userName?.slice(0, 1)}
          </span>
          <div>
            <strong>{Number(member.userId) === userId ? 'You' : member.userName}</strong>
            <small>
              {member.studentVerified
                ? 'VIT ✓ · '
                : member.verified
                  ? 'Phone ✓ · '
                  : ''}
              {member.ready ? 'Ready' : 'Not ready'}
            </small>
          </div>
        </div>)}
      </div>

      <div className="home-match-stats">
        <div><span>PASSENGERS</span><strong>{members.length}/4</strong></div>
        <div><span>READY</span><strong>{readyCount}/{members.length}</strong></div>
        <div><span>LIVE NOW</span><strong>{liveLocations.length}</strong></div>
        <div><span>ROAD ROUTE</span><strong>{activeMatch.routeDistanceKm ? `${Number(activeMatch.routeDistanceKm).toFixed(1)} km` : 'Ready'}</strong></div>
      </div>

      <div className="home-match-primary-actions">
        <Link to={`/groups/${activeMatch.id}`} className="btn next-primary-btn home-ride-main">
          Open ride hub <span>↗</span>
        </Link>
        <button type="button" className="btn next-secondary-btn home-chat-button" onClick={() => setChatOpen(true)}>
          Chat
          {chatUnread > 0 && <span className="home-chat-unread">{chatUnread > 9 ? '9+' : chatUnread}</span>}
        </button>
        <Link to={`/groups/${activeMatch.id}#live-map`} className="btn next-secondary-btn">
          Live map
        </Link>
      </div>

      <div className="home-feature-actions">
        <button type="button" className={`home-feature-action ${currentMember?.ready ? 'is-active' : ''}`} onClick={toggleReady} disabled={!currentMember || readyBusy}>
          <span className="home-feature-icon">✓</span>
          <div>
            <strong>{currentMember?.ready ? 'You’re ready' : 'Mark me ready'}</strong>
            <small>{readyBusy ? 'Updating…' : `${readyCount}/${members.length} ready`}</small>
          </div>
        </button>

        <button type="button" className={`home-feature-action ${liveSharing ? 'is-live' : ''}`} onClick={liveSharing ? stopLiveLocation : startLiveLocation}>
          <span className="home-feature-icon">◎</span>
          <div>
            <strong>{liveSharing ? 'Live location ON' : 'Share live location'}</strong>
            <small>{liveSharing ? 'Tap to stop sharing' : 'Visible to this group only'}</small>
          </div>
        </button>

        <Link to={`/groups/${activeMatch.id}#meeting-point`} className="home-feature-action">
          <span className="home-feature-icon">M</span>
          <div>
            <strong>Meeting point</strong>
            <small>Open the suggested meetup</small>
          </div>
        </Link>

        <button type="button" className="home-feature-action" onClick={copyInvite}>
          <span className="home-feature-icon">↗</span>
          <div>
            <strong>{copyState || 'Invite someone'}</strong>
            <small>Copy the group invite link</small>
          </div>
        </button>

        {notificationPermission !== 'unsupported' &&
          <button type="button" className={`home-feature-action ${notificationPermission === 'granted' ? 'is-active' : ''}`} onClick={enableNotifications} disabled={notificationPermission === 'granted'}>
            <span className="home-feature-icon">◉</span>
            <div>
              <strong>{notificationPermission === 'granted' ? 'Notifications ON' : 'Enable notifications'}</strong>
              <small>Messages, members and ride updates</small>
            </div>
          </button>}
      </div>

      {liveError && <p className="form-error home-live-error">{liveError}</p>}

      <p className="home-match-note">
        Everything for this match is now reachable from Home. Use the Ride Hub when you want the full map, meeting point and group chat together.
      </p>
    </section>}

    {activeMatch && <section className="home-next-steps" aria-label="What to do next">
      <div className="home-next-step-head">
        <div>
          <p className="eyebrow">WHAT TO DO NEXT</p>
          <h2>Three simple steps.</h2>
        </div>
        <Link to={`/groups/${activeMatch.id}`} className="text-link">Open full ride →</Link>
      </div>
      <div className="home-next-step-grid">
        <button type="button" onClick={toggleReady} disabled={!currentMember || readyBusy} className={currentMember?.ready ? 'done' : ''}>
          <span>1</span>
          <div>
            <strong>{currentMember?.ready ? 'Ready confirmed' : 'Confirm you’re ready'}</strong>
            <small>{currentMember?.ready ? 'You’re set for this ride.' : 'Tell the group you’re ready to leave.'}</small>
          </div>
        </button>
        <Link to={`/groups/${activeMatch.id}#meeting-point`}>
          <span>2</span>
          <div>
            <strong>Check the meeting point</strong>
            <small>Know where everyone should meet.</small>
          </div>
        </Link>
        <Link to={`/groups/${activeMatch.id}#coordination`}>
          <span>3</span>
          <div>
            <strong>Coordinate in chat</strong>
            <small>Agree on timing and external cab booking.</small>
          </div>
        </Link>
      </div>
    </section>}

    {!activeMatch && <section className="next-hero">
      <div className="next-hero-aurora aurora-one" aria-hidden="true"></div>
      <div className="next-hero-aurora aurora-two" aria-hidden="true"></div>
      <div className="next-hero-grain" aria-hidden="true"></div>

      <div className="next-hero-copy">
        <div className="next-status-pill"><span></span> Route matching is live</div>
        <p className="hero-eyebrow">HEY {name.split(' ')[0].toUpperCase()}</p>
        <h1 className="next-hero-title">
          {activeMatch ? <>Your next ride is already<br /><span>coming together.</span></> : <>Stop looking for a ride.<br /><span>Find your people.</span></>}
        </h1>
        <p className="next-hero-subtitle">
          {activeMatch
            ? 'Your active match is pinned above. Chat, readiness, live location, meeting point and invites are one tap away.'
            : 'FLUX matches students by real road overlap, timing and pickup detour — then gives the group one place to coordinate everything.'}
        </p>

        <div className="next-hero-actions">
          {activeMatch ? <Link to={`/groups/${activeMatch.id}`} className="btn next-primary-btn">
            Open my active ride
            <span className="btn-arrow">↗</span>
          </Link> : <Link to="/find" className="btn next-primary-btn">
            Find people on my route
            <span className="btn-arrow">↗</span>
          </Link>}
          <Link to="/my-trips" className="btn next-secondary-btn">
            Open my trips
            <span>→</span>
          </Link>
        </div>

        <div className="next-proof-row">
          <div><strong>Real roads</strong><span>not text matching</span></div>
          <div><strong>Private by default</strong><span>you control sharing</span></div>
          <div><strong>Built for students</strong><span>fast, social, simple</span></div>
        </div>
      </div>

      <div className="next-hero-demo" aria-hidden="true">
        <div className="demo-phone-shell">
          <div className="demo-phone-top">
            <span>FLUX RIDE</span>
            <i></i>
          </div>
          <div className="demo-route-panel">
            <span className="demo-label">LIVE ROUTE</span>
            <strong>VIT Pune → Koregaon Park</strong>
            <div className="demo-route-line">
              <i className="demo-route-start"></i>
              <i className="demo-route-flow"></i>
              <i className="demo-route-end"></i>
            </div>
            <div className="demo-route-meta">
              <span>8.4 km</span>
              <span>24 min</span>
              <span>3 seats</span>
            </div>
          </div>

          <div className="demo-match-card">
            <div className="demo-match-score"><strong>92</strong><span>%</span></div>
            <div>
              <span>BEST MATCH</span>
              <strong>Swapnil + 1</strong>
              <small>84% shared route · +0.6 km detour</small>
            </div>
          </div>

          <div className="demo-people-row">
            <span>NS</span><span>SP</span><span>TS</span>
            <small>3 people ready to coordinate</small>
          </div>
        </div>

        <div className="floating-chip floating-chip-one">
          <span className="chip-pulse"></span>
          {typeof count === 'number' ? count + ' active shared ' + (count === 1 ? 'trip' : 'trips') : 'Matching live'}
        </div>

        <div className="floating-chip floating-chip-two">
          <strong>₹148</strong>
          <span>estimated savings</span>
        </div>
      </div>
    </section>}

    {commute && <section className="next-commute-card">
      <div className="next-commute-icon" aria-hidden="true">↻</div>
      <div className="daily-commute-copy">
        <p className="eyebrow">YOUR DAILY COMMUTE</p>
        <h2>{shortPlace(commute.pickup?.label)} <span>→</span> {shortPlace(commute.destination?.label)}</h2>
        <p>Usual departure · {commute.departureClock || 'Saved time'}</p>
      </div>
      <div className="daily-commute-actions">
        <Link to="/find?commute=1" className="btn next-primary-btn compact">Find today’s people <span>↗</span></Link>
        <button type="button" className="btn next-secondary-btn compact" onClick={clearCommute}>Remove</button>
      </div>
    </section>}

    {!activeMatch && <><section className="next-section-head">
      <div>
        <p className="eyebrow">WHY IT FEELS DIFFERENT</p>
        <h2>Less searching. More moving.</h2>
      </div>
      <Link to="/find" className="text-link">Try it now ↗</Link>
    </section>

    <section className="next-feature-grid">
      <article className="next-feature-card feature-violet">
        <div className="feature-card-number">01</div>
        <div className="feature-card-icon">⌖</div>
        <h3>Route-first matching</h3>
        <p>FLUX compares real roads, not just typed location names.</p>
        <div className="feature-card-metric"><strong>84%</strong><span>shared route</span></div>
      </article>

      <article className="next-feature-card feature-cyan">
        <div className="feature-card-number">02</div>
        <div className="feature-card-icon">≈</div>
        <h3>Know the trade-off</h3>
        <p>See route overlap, time difference and pickup detour before joining.</p>
        <div className="feature-card-metric"><strong>+0.8 km</strong><span>pickup detour</span></div>
      </article>

      <article className="next-feature-card feature-pink">
        <div className="feature-card-number">03</div>
        <div className="feature-card-icon">✦</div>
        <h3>One group room</h3>
        <p>Chat, readiness, live location, meeting point and invite links in one place.</p>
        <div className="feature-card-metric"><strong>1 room</strong><span>everything together</span></div>
      </article>
    </section></>}

    {activeMatch && <section className="home-secondary-actions">
      <div>
        <p className="eyebrow">NEED ANOTHER RIDE?</p>
        <strong>Plan another route without losing this match.</strong>
      </div>
      <Link to="/find" className="btn next-secondary-btn">Find another ride <span>↗</span></Link>
    </section>}

    {chatOpen && activeMatch && <div className="home-chat-drawer-shell" role="dialog" aria-modal="true" aria-label="Ride chat">
      <button className="home-chat-backdrop" type="button" aria-label="Close ride chat" onClick={() => setChatOpen(false)}></button>
      <aside className="home-chat-drawer">
        <div className="home-chat-drawer-head">
          <div>
            <p className="eyebrow">ACTIVE RIDE</p>
            <strong>{activeMatch.destinationLabel}</strong>
          </div>
          <button type="button" className="home-chat-close" onClick={() => setChatOpen(false)} aria-label="Close chat">×</button>
        </div>
        <RideChat
          groupId={activeMatch.id}
          members={members}
          compact
          autoFocus
        />
        <Link to={`/groups/${activeMatch.id}#coordination`} className="home-chat-full-link" onClick={() => setChatOpen(false)}>
          Open full Ride Hub →
        </Link>
      </aside>
    </div>}

    <section className="team-flux-home-credit">
      <span className="credit-line"></span>
      <p>Made with intent by <strong>Team FLUX</strong></p>
      <span className="credit-line"></span>
    </section>
  </div>;
}

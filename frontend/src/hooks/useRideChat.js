import { useCallback, useEffect, useRef, useState } from 'react';
import axiosClient from '../api/axiosClient';

function socketUrl(groupId) {
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  const url = new URL(apiBase);
  const token = localStorage.getItem('flux_auth_token') || '';

  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws/chat';
  url.search = '';
  url.searchParams.set('groupId', groupId);
  url.searchParams.set('token', token);

  return url.toString();
}

function mergeMessages(current, incoming) {
  const byId = new Map(current.map(item => [String(item.id), item]));
  incoming.forEach(item => {
    if (item?.id != null) byId.set(String(item.id), item);
  });

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

export default function useRideChat(groupId, userId) {
  const [messages, setMessages] = useState([]);
  const [socketState, setSocketState] = useState('connecting');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [chatError, setChatError] = useState('');
  const [sending, setSending] = useState(false);

  const socketRef = useRef(null);
  const reconnectTimer = useRef(null);
  const intentionalClose = useRef(false);
  const typingTimers = useRef(new Map());

  const loadHistory = useCallback(async () => {
    if (!groupId || !userId) return;

    try {
      const response = await axiosClient.get(
        `/api/pools/${groupId}/messages?userId=${userId}`
      );
      setMessages(current => mergeMessages(current, response.data || []));
      setChatError('');
    } catch (err) {
      setChatError(err.message);
    }
  }, [groupId, userId]);

  useEffect(() => {
    setMessages([]);
    setOnlineUsers([]);
    setTypingUsers([]);
    setChatError('');
    intentionalClose.current = false;

    if (!groupId || !userId) return undefined;

    let attempt = 0;

    function connect() {
      if (intentionalClose.current) return;

      setSocketState(attempt === 0 ? 'connecting' : 'reconnecting');

      const socket = new WebSocket(socketUrl(groupId));
      socketRef.current = socket;

      socket.onopen = () => {
        attempt = 0;
        setSocketState('connected');
        setChatError('');
      };

      socket.onmessage = event => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'message' && payload.message) {
            setMessages(current => mergeMessages(current, [payload.message]));

            if (
              Number(payload.message.userId) !== Number(userId)
              && document.hidden
              && 'Notification' in window
              && Notification.permission === 'granted'
            ) {
              new Notification('New FLUX RIDE message', {
                body: `${payload.message.userName}: ${payload.message.message}`
              });
            }
          }

          if (payload.type === 'presence') {
            setOnlineUsers(payload.users || []);
          }

          if (payload.type === 'typing' && Number(payload.userId) !== Number(userId)) {
            setTypingUsers(current => {
              const withoutUser = current.filter(item => Number(item.userId) !== Number(payload.userId));
              return payload.typing
                ? [...withoutUser, { userId: payload.userId, userName: payload.userName }]
                : withoutUser;
            });

            const oldTimer = typingTimers.current.get(String(payload.userId));
            if (oldTimer) window.clearTimeout(oldTimer);

            if (payload.typing) {
              const timer = window.setTimeout(() => {
                setTypingUsers(current =>
                  current.filter(item => Number(item.userId) !== Number(payload.userId))
                );
              }, 3500);
              typingTimers.current.set(String(payload.userId), timer);
            }
          }
        } catch (_) {
          // Ignore malformed socket events. REST history remains the fallback.
        }
      };

      socket.onerror = () => {
        setSocketState('reconnecting');
      };

      socket.onclose = () => {
        if (intentionalClose.current) return;
        setSocketState('reconnecting');
        attempt += 1;
        const delay = Math.min(1000 * Math.max(1, attempt), 5000);
        reconnectTimer.current = window.setTimeout(connect, delay);
      };
    }

    loadHistory();
    connect();

    return () => {
      intentionalClose.current = true;
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      typingTimers.current.forEach(timer => window.clearTimeout(timer));
      typingTimers.current.clear();

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [groupId, userId, loadHistory]);

  // Reliability fallback: when the socket is not healthy, quietly sync history.
  useEffect(() => {
    if (socketState === 'connected' || !groupId || !userId) return undefined;
    const timer = window.setInterval(loadHistory, 8000);
    return () => window.clearInterval(timer);
  }, [socketState, groupId, userId, loadHistory]);

  function sendTyping(typing) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    try {
      socket.send(JSON.stringify({ type: 'typing', typing: Boolean(typing) }));
    } catch (_) {
      // Typing indicators are best-effort only.
    }
  }

  async function sendMessage(message) {
    const clean = String(message || '').trim();
    if (!clean || sending) return null;

    setSending(true);
    setChatError('');

    try {
      const response = await axiosClient.post(
        `/api/pools/${groupId}/messages`,
        { userId: Number(userId), message: clean }
      );

      if (response.data) {
        setMessages(current => mergeMessages(current, [response.data]));
      }

      sendTyping(false);
      return response.data || null;
    } catch (err) {
      setChatError(err.message);
      throw err;
    } finally {
      setSending(false);
    }
  }

  return {
    messages,
    socketState,
    onlineUsers,
    typingUsers,
    chatError,
    sending,
    sendMessage,
    sendTyping,
    reload: loadHistory
  };
}

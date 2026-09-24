import { useCallback, useEffect, useRef, useState } from 'react';
import axiosClient from '../api/axiosClient';

const ACTIVE_LIVE_GROUP_KEY = 'flux_live_group_id';
const MIN_SEND_INTERVAL_MS = 2200;
const HEARTBEAT_MS = 6000;
const MOVE_TRIGGER_METERS = 12;

function distanceMeters(first, second) {
  if (!first || !second) return Infinity;

  const toRad = value => value * Math.PI / 180;
  const radius = 6371000;
  const dLat = toRad(second.latitude - first.latitude);
  const dLng = toRad(second.longitude - first.longitude);
  const lat1 = toRad(first.latitude);
  const lat2 = toRad(second.latitude);

  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mergeLocation(current, next) {
  const withoutUser = current.filter(
    item => Number(item.userId) !== Number(next.userId)
  );

  return [...withoutUser, next].sort(
    (a, b) => Number(a.userId) - Number(b.userId)
  );
}

function numericOrNull(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

export default function useRideLiveLocation({
  groupId,
  userId,
  userName
}) {
  const [liveLocations, setLiveLocations] = useState([]);
  const [sharing, setSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [ownLocation, setOwnLocation] = useState(null);

  const watchId = useRef(null);
  const lastSentAt = useRef(0);
  const lastSentPoint = useRef(null);
  const startingRef = useRef(false);
  const mounted = useRef(true);

  const loadLocations = useCallback(async () => {
    if (!groupId || !userId) {
      setLiveLocations([]);
      return;
    }

    try {
      const response = await axiosClient.get(
        `/api/pools/${groupId}/live-locations?userId=${userId}`
      );

      if (!mounted.current) return;

      const incoming = response.data || [];
      setLiveLocations(current => {
        const optimisticOwn = current.find(
          item =>
            Number(item.userId) === Number(userId)
            && item.optimistic
        );

        if (
          optimisticOwn
          && !incoming.some(
            item => Number(item.userId) === Number(userId)
          )
        ) {
          return [...incoming, optimisticOwn];
        }

        return incoming;
      });
    } catch (_) {
      // Keep the last good positions during brief network interruptions.
    }
  }, [groupId, userId]);

  const stopWatchOnly = useCallback(() => {
    if (watchId.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    startingRef.current = false;
    setStarting(false);
  }, []);

  const sendPosition = useCallback(async position => {
    if (!groupId || !userId) return;

    const coords = position.coords;
    const point = {
      userId: Number(userId),
      userName: userName || 'You',
      latitude: Number(coords.latitude),
      longitude: Number(coords.longitude),
      accuracyMeters: numericOrNull(coords.accuracy),
      speedMetersPerSecond: numericOrNull(coords.speed),
      headingDegrees: numericOrNull(coords.heading),
      updatedAt: new Date().toISOString(),
      optimistic: true
    };

    const now = Date.now();
    const elapsed = now - lastSentAt.current;
    const moved = distanceMeters(lastSentPoint.current, point);

    if (
      lastSentAt.current > 0
      && elapsed < HEARTBEAT_MS
      && !(elapsed >= MIN_SEND_INTERVAL_MS && moved >= MOVE_TRIGGER_METERS)
    ) {
      return;
    }

    lastSentAt.current = now;
    lastSentPoint.current = point;

    if (mounted.current) {
      setOwnLocation(point);
      setLiveLocations(current => mergeLocation(current, point));
    }

    try {
      await axiosClient.post(
        `/api/pools/${groupId}/location/${userId}`,
        {
          sharing: true,
          latitude: point.latitude,
          longitude: point.longitude,
          accuracyMeters: point.accuracyMeters,
          speedMetersPerSecond: point.speedMetersPerSecond,
          headingDegrees: point.headingDegrees
        }
      );

      if (!mounted.current) return;

      localStorage.setItem(
        ACTIVE_LIVE_GROUP_KEY,
        String(groupId)
      );
      setSharing(true);
      setStarting(false);
      startingRef.current = false;
      setError('');

      setLiveLocations(current =>
        mergeLocation(
          current,
          { ...point, optimistic: false }
        )
      );
    } catch (err) {
      if (!mounted.current) return;
      setError(err.message);
    }
  }, [groupId, userId, userName]);

  const start = useCallback(() => {
    if (!groupId) return;

    if (!navigator.geolocation) {
      setError('Live location is not supported by this browser.');
      return;
    }

    if (watchId.current != null || startingRef.current) return;

    setError('');
    setStarting(true);
    startingRef.current = true;

    watchId.current = navigator.geolocation.watchPosition(
      position => {
        sendPosition(position);
      },
      locationError => {
        stopWatchOnly();
        setSharing(false);

        if (locationError.code === 1) {
          localStorage.removeItem(ACTIVE_LIVE_GROUP_KEY);
          setError(
            'Location permission is blocked. Allow precise location for FLUX in your browser settings.'
          );
        } else if (locationError.code === 2) {
          setError(
            'Your device cannot determine its location right now. Move near a window or turn location services on.'
          );
        } else {
          setError(
            'Location is taking too long. Try again when GPS or network location is available.'
          );
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2500,
        timeout: 18000
      }
    );
  }, [groupId, sendPosition, stopWatchOnly]);

  const stop = useCallback(async () => {
    stopWatchOnly();
    setSharing(false);
    setOwnLocation(null);
    lastSentAt.current = 0;
    lastSentPoint.current = null;

    if (
      localStorage.getItem(ACTIVE_LIVE_GROUP_KEY)
      === String(groupId)
    ) {
      localStorage.removeItem(ACTIVE_LIVE_GROUP_KEY);
    }

    setLiveLocations(current =>
      current.filter(
        item => Number(item.userId) !== Number(userId)
      )
    );

    if (!groupId || !userId) return;

    try {
      await axiosClient.post(
        `/api/pools/${groupId}/location/${userId}`,
        {
          sharing: false,
          latitude: null,
          longitude: null,
          accuracyMeters: null,
          speedMetersPerSecond: null,
          headingDegrees: null
        }
      );
      if (mounted.current) setError('');
    } catch (err) {
      if (mounted.current) setError(err.message);
    }
  }, [groupId, userId, stopWatchOnly]);

  useEffect(() => {
    mounted.current = true;
    loadLocations();

    if (
      groupId
      && localStorage.getItem(ACTIVE_LIVE_GROUP_KEY)
        === String(groupId)
    ) {
      const timer = window.setTimeout(start, 120);
      return () => {
        window.clearTimeout(timer);
        mounted.current = false;
        stopWatchOnly();
      };
    }

    return () => {
      mounted.current = false;
      stopWatchOnly();
    };
  }, [groupId, loadLocations, start, stopWatchOnly]);

  useEffect(() => {
    if (!groupId || !userId) return undefined;

    const timer = window.setInterval(
      loadLocations,
      4000
    );

    return () => window.clearInterval(timer);
  }, [groupId, userId, loadLocations]);

  return {
    liveLocations,
    sharing,
    starting,
    error,
    ownLocation,
    start,
    stop,
    refresh: loadLocations
  };
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import Loader from '../components/Loader';
import PoolCard from '../components/PoolCard';
import { GroupMap } from '../components/OpenStreetMap';

export default function GroupRoom() {
  const { groupId } = useParams();
  const userId = localStorage.getItem('flux_user_id');
  const [group, setGroup] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const response = await axiosClient.get(`/api/pools/user/${userId}`);
        if (!alive) return;
        const found = (response.data || []).find(item => String(item.id) === String(groupId));
        if (!found) throw new Error('This group was not found or you are not a member.');
        setGroup(found);
        setError('');
      } catch (err) { if (alive) setError(err.message); }
      finally { if (alive) setLoading(false); }
    }
    load();
    const timer = window.setInterval(load, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [groupId, userId]);

  return <div className="page-container group-room-page">
    <div className="group-room-header">
      <div><p className="eyebrow">YOUR SHARED RIDE</p><h1 className="page-title">Group Room</h1>
        <p className="page-subtitle">See who’s travelling with you and coordinate the ride together.</p></div>
      <Link to="/my-trips" className="btn btn-ghost">← My trips</Link>
    </div>
    {loading ? <Loader label="Opening your group…" /> :
      error ? <div className="empty-state"><h2>Couldn’t open this group.</h2><p className="form-error">{error}</p><Link to="/my-trips" className="btn btn-primary">Back to My trips</Link></div> :
      <div className="group-room-layout">
        <section className="group-room-map-preview">
          <p className="eyebrow">LIVE GROUP MAP</p>
          <h2>{group.destinationLabel}</h2>
          {Number.isFinite(group.destinationLatitude) && Number.isFinite(group.destinationLongitude)
            ? <GroupMap
                destination={{ lat: group.destinationLatitude, lng: group.destinationLongitude, label: `Destination · ${group.destinationLabel}` }}
                members={group.members || []}
              />
            : <div className="map-empty-state"><strong>Map coordinates aren’t available for this older trip.</strong><p>New trips created with the map picker will show every passenger pickup here.</p></div>}
          <p>Pickup markers are visible only to members of this shared group.</p>
        </section>
        <PoolCard pool={group} />
      </div>}
  </div>;
}

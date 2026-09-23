import { useEffect, useMemo, useState } from 'react';

const QR_SCRIPT = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';
let qrPromise;

function ensureQrLibrary() {
  if (window.QRCode?.toDataURL) return Promise.resolve(window.QRCode);
  if (qrPromise) return qrPromise;

  qrPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-flux-qr]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.QRCode), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = QR_SCRIPT;
    script.async = true;
    script.dataset.fluxQr = 'true';
    script.onload = () => resolve(window.QRCode);
    script.onerror = () => reject(new Error('QR generator could not be loaded.'));
    document.head.appendChild(script);
  });

  return qrPromise;
}

export default function InviteShareCard({ groupId, destination, departureTime, onClose }) {
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState('');

  const inviteUrl = useMemo(
    () => \`\${window.location.origin}/invite/\${groupId}\`,
    [groupId]
  );

  useEffect(() => {
    let active = true;

    ensureQrLibrary()
      .then(QRCode => QRCode.toDataURL(inviteUrl, {
        width: 280,
        margin: 1,
        errorCorrectionLevel: 'M'
      }))
      .then(value => {
        if (active) setQr(value);
      })
      .catch(() => {
        if (active) setQrError('QR unavailable — the invite link still works.');
      });

    return () => { active = false; };
  }, [inviteUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (_) {
      setCopied(false);
    }
  }

  async function shareLink() {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({
        title: 'Join my FLUX RIDE',
        text: \`Join my shared ride to \${destination || 'our destination'}.\`,
        url: inviteUrl
      });
    } catch (_) {
      // User cancelled the native share sheet.
    }
  }

  return <div className="invite-overlay" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose?.();
  }}>
    <section className="invite-share-card" role="dialog" aria-modal="true" aria-label="Invite people to this ride">
      <button type="button" className="invite-close" onClick={onClose} aria-label="Close invite">×</button>
      <p className="eyebrow">INVITE YOUR PEOPLE</p>
      <h2>Bring someone into this ride.</h2>
      <p className="invite-share-subtitle">
        They’ll see the destination, time and available seats. Their pickup still has to be compatible with the group.
      </p>

      <div className="invite-qr-wrap">
        {qr
          ? <img src={qr} alt="QR code for this FLUX RIDE invite" />
          : <div className="invite-qr-loading">{qrError || 'Generating QR…'}</div>}
      </div>

      <div className="invite-route-mini">
        <span>GROUP #{groupId}</span>
        <strong>{destination}</strong>
        {departureTime && <small>{new Date(departureTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</small>}
      </div>

      <div className="invite-link-row">
        <input readOnly value={inviteUrl} aria-label="Invite link" />
        <button type="button" className="btn btn-ghost" onClick={copyLink}>{copied ? 'Copied' : 'Copy'}</button>
      </div>

      <button type="button" className="btn btn-primary btn-block invite-share-main" onClick={shareLink}>
        Share invite ↗
      </button>
    </section>
  </div>;
}

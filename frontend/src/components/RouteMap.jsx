// A deliberately non-realistic "map": a grid canvas where each location string
// is hashed to a deterministic point, and a route line is drawn between them.
// This keeps the app fully offline (no Google Maps / Mapbox key needed) while
// still giving a visual sense of "a route was found".

function hashToPoint(label, size = 400, margin = 60) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  const x = margin + (hash % (size - margin * 2));
  const y = margin + ((hash >> 8) % (size - margin * 2));
  return { x, y };
}

function GridLines({ size }) {
  const lines = [];
  for (let i = 0; i <= size; i += 40) {
    lines.push(<line key={`v${i}`} x1={i} y1={0} x2={i} y2={size} className="grid-line" />);
    lines.push(<line key={`h${i}`} x1={0} y1={i} x2={size} y2={i} className="grid-line" />);
  }
  return <>{lines}</>;
}

/**
 * points: [{ label, kind }] where kind is 'pickup' | 'drop' | 'member'
 * Renders in order, connecting each consecutive point with a dashed route line.
 */
export default function RouteMap({ points = [] }) {
  const size = 400;
  const resolved = points.map((p) => ({ ...p, ...hashToPoint(p.label, size) }));

  const pathD = resolved
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const colorFor = (kind) =>
    kind === 'drop' ? '#111827' : kind === 'member' ? '#14B8A6' : '#4F46E5';

  return (
    <div className="route-map">
      <svg viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width={size} height={size} fill="#F9FAFB" rx="16" />
        <GridLines size={size} />

        {resolved.length > 1 && (
          <path d={pathD} className="route-line" fill="none" />
        )}

        {resolved.map((p, i) => (
          <g key={i} className="route-pin-group">
            <circle cx={p.x} cy={p.y} r="8" fill={colorFor(p.kind)} className="route-pin" />
            <circle cx={p.x} cy={p.y} r="14" fill={colorFor(p.kind)} opacity="0.15" />
            <text x={p.x} y={p.y - 16} textAnchor="middle" className="route-pin-label">
              {p.label.length > 14 ? p.label.slice(0, 14) + '…' : p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

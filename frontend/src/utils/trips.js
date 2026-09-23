export function formatDeparture(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Departure not available' : new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
  }).format(date);
}

export function matchPercentage(score) {
  const value = Number(score);
  return Number.isFinite(value) ? Math.round(Math.min(1, Math.max(0, value)) * 100) : 0;
}

export function isFuture(value) {
  return new Date(value).getTime() > Date.now();
}

export function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

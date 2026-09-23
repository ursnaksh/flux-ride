import { useEffect } from 'react';

export default function AmbientGlow() {
  useEffect(() => {
    if (
      window.matchMedia('(pointer: coarse)').matches
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) return;

    const root = document.documentElement;
    let frame = 0;

    function move(event) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--pointer-x', event.clientX + 'px');
        root.style.setProperty('--pointer-y', event.clientY + 'px');
      });
    }

    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
    };
  }, []);

  return <div className="ambient-pointer-glow" aria-hidden="true"></div>;
}

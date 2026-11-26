import { useEffect, useMemo } from 'react';
import { isChristmas } from './game.js';

// Juletema: sætter klassen "jul" på <html> (sne på kortene i styles.css) og lader sne falde i baggrunden.
export default function Jul() {
  const on = isChristmas();
  useEffect(() => {
    document.documentElement.classList.toggle('jul', on);
    return () => document.documentElement.classList.remove('jul');
  }, [on]);

  // Faste "tilfældige" værdier, så sneen ikke hopper ved hver gentegning
  const flakes = useMemo(() => Array.from({ length: 28 }, (_, i) => {
    const r = (n) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    return {
      left: `${Math.round(r(1) * 100)}%`,
      size: 4 + Math.round(r(2) * 4),
      duration: `${9 + r(3) * 9}s`,
      delay: `${-r(4) * 18}s`,
      sway: `${Math.round((r(5) - 0.5) * 60)}px`,
    };
  }), []);

  if (!on) return null;
  return (
    <div className="snowfall" aria-hidden="true">
      {flakes.map((f, i) => (
        <span key={i} style={{ left: f.left, width: f.size, height: f.size, animationDuration: f.duration, animationDelay: f.delay, '--sway': f.sway }} />
      ))}
    </div>
  );
}

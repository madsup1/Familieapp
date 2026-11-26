import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Figure from './Figure.jsx';
import { STAGE_NAMES, firstName, genitive, pctText } from './game.js';

// Stor visning af en spillers figur (åbnes fra "Stilling denne uge").
export default function FigureZoom({ player: p, rank, isMe, appearance, items, figName, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const owner = isMe ? 'Din' : genitive(firstName(p.name));
  const title = figName || `${owner} figur`;
  const size = Math.min(300, (typeof window !== 'undefined' ? window.innerWidth : 390) - 72);

  return (
    <div className="zoom-backdrop" onClick={onClose}>
      <div className="zoom-card card" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="fake-close" onClick={onClose} aria-label="Luk"><X size={18} /></button>
        <h2 className="pixel zoom-title">{title}</h2>
        <p className="sub">
          {figName ? `${owner} træningsmakker · ` : ''}{rank}. plads denne uge
        </p>
        <div className="zoom-figure">
          <Figure interactive appearance={appearance} items={items} stats={p.stats} decay={p.decay} size={size} label={title} />
        </div>
        <h3 className="pixel label">{STAGE_NAMES[p.stage - 1]} · Trin {p.stage}</h3>
        <div className="statgrid">
          <div className="stat"><span>Niveau</span><b className="pixel">{p.level}</b></div>
          <div className="stat"><span>XP i alt</span><b className="pixel">{Math.round(p.stats.total).toLocaleString('da-DK')}</b></div>
          <div className="stat"><span className="green-text">Udholdenhed</span><b className="pixel">{Math.round(p.stats.stamina).toLocaleString('da-DK')}</b></div>
          <div className="stat"><span className="orange-text">Styrke</span><b className="pixel">{Math.round(p.stats.strength).toLocaleString('da-DK')}</b></div>
        </div>
        <p className="zoom-week">
          <strong>Denne uge:</strong> {p.prog.days} af {p.prog.goal} dage ({pctText(p.prog.pct)})
        </p>
        <p className={`formtag level-${p.form.level}`}>
          {p.form.label}{p.form.level > 0 ? ` · ${p.form.days} dage uden træning` : ''}
        </p>
      </div>
    </div>
  );
}

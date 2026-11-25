import { useEffect, useMemo, useRef, useState } from 'react';
import { THREE, buildCharacter, disposeScene } from './voxel.js';
import { firstName, pctText } from './game.js';

// Når en duel er afgjort, vises en kamp mellem de to figurer, første gang man åbner appen bagefter.
// "Set" huskes pr. enhed i localStorage.
const SEEN_KEY = (id) => `duel-set:${id}`;
const SHOW_DAYS = 14; // gamle dueller vises ikke igen på en ny telefon

export function duelToReveal(duels, meId) {
  const since = Date.now() - SHOW_DAYS * 86400000;
  return duels.find((d) => d.status === 'finished'
    && (d.challenger_id === meId || d.opponent_id === meId)
    && new Date(d.end_at).getTime() > since
    && !localStorage.getItem(SEEN_KEY(d.id))) || null;
}

const PIXEL = 3;
const HITS = ['POW!', 'BAM!', 'KLONK!', 'BOING!', 'WHAM!', 'ZAP!'];
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

// Tidslinje i sekunder
const T_IN = 1.2;        // figurerne løber ind
const T_FIGHT = 4.4;     // slagudveksling slutter
const T_FINAL = 5.6;     // afgørende slag, taberen falder
const T_RESULT = 6.0;    // resultatet vises

function score(d, side) {
  const weeks = (new Date(d.end_at) - new Date(d.start_at)) / (7 * 86400000) || 1;
  const goal = (side === 'c' ? d.challenger_goal : d.opponent_goal) || 3;
  const days = (side === 'c' ? d.challenger_days : d.opponent_days) ?? 0;
  const xp = Number(side === 'c' ? d.challenger_xp : d.opponent_xp) || 0;
  return { days, target: Math.max(1, Math.round(goal * weeks)), pct: days / Math.max(goal * weeks, 1), xp };
}

export default function DuelReveal({ duel, me, players, items, appearanceOf, figNameOf, onClose }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const powRef = useRef(null);
  const [phase, setPhase] = useState('fight');
  const itemsById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  const meIsC = duel.challenger_id === me.id;
  const oppId = meIsC ? duel.opponent_id : duel.challenger_id;
  const mine = score(duel, meIsC ? 'c' : 'o');
  const theirs = score(duel, meIsC ? 'o' : 'c');
  const iWon = duel.winner_id === me.id;
  const tie = !duel.winner_id;
  const playerOf = (id) => players.find((p) => p.id === id);
  const label = (id) => figNameOf(id) || firstName(playerOf(id)?.name ?? 'Ukendt');
  const oppName = firstName(playerOf(oppId)?.name ?? 'Modstanderen');

  function close() {
    localStorage.setItem(SEEN_KEY(duel.id), '1');
    onClose();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    } catch {
      setPhase('result');
      return undefined;
    }
    renderer.setPixelRatio(1);

    const scene = new THREE.Scene();
    const bg = 0x1b1d2b;
    scene.background = new THREE.Color(bg);
    scene.fog = new THREE.Fog(bg, 90, 170);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2c40, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(20, 50, 40);
    scene.add(sun);

    // Arena: gulv, ring-linjer og publikum
    const box = (w, h, d, x, y, z, color) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
      m.position.set(x, y, z);
      scene.add(m);
      return m;
    };
    box(120, 2, 80, 0, -1, 0, 0x3a3f5c);
    box(70, 0.3, 40, 0, 0.1, 0, 0x2f66f3);
    for (const z of [-20, 20]) box(70, 0.4, 0.8, 0, 0.25, z, 0xffffff);
    for (const x of [-35, 35]) box(0.8, 0.4, 40, x, 0.25, 0, 0xffffff);
    for (const [x, z] of [[-35, -20], [35, -20], [-35, 20], [35, 20]]) box(1.6, 12, 1.6, x, 6, z, 0xe8553d);
    for (let i = 0; i < 30; i++) box(2, 2.4, 2, -58 + i * 4, 4 + (i % 3), -38, [0xf5c518, 0xe8553d, 0x3f9d6a, 0xffffff][i % 4]);

    // Figurerne: holder styrer position og fald, figuren indeni vender mod modstanderen
    const make = (id, side) => {
      const p = playerOf(id);
      const holder = new THREE.Group();
      const fig = buildCharacter(appearanceOf(id), itemsById, p?.stats, 0);
      fig.rotation.y = side * (Math.PI / 2 - 0.55);
      holder.add(fig);
      scene.add(holder);
      return holder;
    };
    const left = make(me.id, 1);   // mig til venstre, kigger mod højre
    const right = make(oppId, -1);

    const camera = new THREE.PerspectiveCamera(40, 1, 1, 400);
    const resize = () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      renderer.setSize(Math.round((w * dpr) / PIXEL), Math.round((h * dpr) / PIXEL), false);
      camera.aspect = w / h;
      // Afstand så begge figurer (ca. 56 enheder bredt) altid er med, også på en smal telefon
      const halfW = 30;
      const dist = Math.max(62, halfW / (Math.tan((camera.fov * Math.PI) / 360) * camera.aspect));
      camera.position.set(0, 20 + dist * 0.12, dist);
      camera.lookAt(0, 15, 0);
      camera.updateProjectionMatrix();
      scene.fog.near = dist + 40;
      scene.fog.far = dist + 160;
    };
    resize();
    window.addEventListener('resize', resize);

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let raf = 0;
    let lastHit = -1;
    const loserSide = tie ? 0 : iWon ? 1 : -1; // 1 = højre falder, -1 = venstre falder

    const pow = (text, x) => {
      const el = powRef.current;
      if (!el) return;
      el.textContent = text;
      el.style.left = `${50 + x}%`;
      el.classList.remove('show');
      void el.offsetWidth; // genstart CSS-animationen
      el.classList.add('show');
    };

    const frame = (now) => {
      const t = reduce ? T_RESULT + 1 : (now - start) / 1000;
      const bounce = Math.abs(Math.sin(t * 9)) * 1.2;
      let lx = -13, rx = 13, ly = 0, ry = 0, lr = 0, rr = 0, shake = 0;

      if (t < T_IN) {
        const k = ease(clamp01(t / T_IN));
        lx = -55 + 42 * k;
        rx = 55 - 42 * k;
        ly = bounce; ry = bounce;
      } else if (t < T_FIGHT) {
        // Seks slag, skiftevis
        const f = t - T_IN;
        const n = Math.floor(f / 0.53);
        const k = (f % 0.53) / 0.53;
        const lunge = Math.sin(Math.PI * k) * 7;
        const recoil = k > 0.5 ? Math.sin(Math.PI * (k - 0.5) * 2) * 3 : 0;
        if (n % 2 === 0) { lx += lunge; rx += recoil; } else { rx -= lunge; lx -= recoil; }
        ly = bounce; ry = bounce;
        if (k > 0.45 && n !== lastHit) {
          lastHit = n;
          pow(HITS[n % HITS.length], n % 2 === 0 ? 8 : -8);
        }
        shake = k > 0.45 && k < 0.65 ? 0.8 : 0;
      } else {
        const k = clamp01((t - T_FIGHT) / (T_FINAL - T_FIGHT));
        if (lastHit !== 99) {
          lastHit = 99;
          pow(tie ? 'KLONK!' : 'KO!', loserSide === 1 ? 10 : loserSide === -1 ? -10 : 0);
        }
        if (tie) {
          // Uafgjort: begge vakler og sætter sig
          lx = -13 - Math.sin(Math.min(k, 1) * Math.PI) * 4;
          rx = 13 + Math.sin(Math.min(k, 1) * Math.PI) * 4;
          lr = Math.sin(t * 6) * 0.15; rr = -Math.sin(t * 6) * 0.15;
        } else {
          const fall = ease(k);
          const winnerHop = t > T_FINAL ? Math.abs(Math.sin((t - T_FINAL) * 6)) * 5 : 0;
          if (loserSide === 1) {
            lx = -13 + Math.sin(Math.min(k * 2, 1) * Math.PI) * 9;
            rx = 13 + fall * 4; rr = -fall * (Math.PI / 2 - 0.1); ly = winnerHop;
          } else {
            rx = 13 - Math.sin(Math.min(k * 2, 1) * Math.PI) * 9;
            lx = -13 - fall * 4; lr = fall * (Math.PI / 2 - 0.1); ry = winnerHop;
          }
        }
        shake = k < 0.25 ? 1.6 : 0;
      }

      left.position.set(lx, ly, 0);
      right.position.set(rx, ry, 0);
      // Taberen falder bagover (væk fra kameraet), så den bliver i billedet
      left.rotation.x = -Math.abs(lr);
      right.rotation.x = -Math.abs(rr);
      if (tie) { left.rotation.z = lr; right.rotation.z = rr; }
      // Vinderen snurrer rundt til sidst
      if (!tie && t > T_FINAL) {
        const w = loserSide === 1 ? left : right;
        w.children[0].rotation.y = (loserSide === 1 ? 1 : -1) * (Math.PI / 2 - 0.55) + (t - T_FINAL) * 4;
      }
      camera.position.x = shake ? (Math.random() - 0.5) * shake : 0;
      renderer.render(scene, camera);

      if (t >= T_RESULT) setPhase('result');
      if (t < T_RESULT + 8) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      disposeScene(scene);
      renderer.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const headline = tie ? 'Uafgjort!' : iWon ? 'Du vandt!' : `${oppName} vandt!`;
  const sub = tie
    ? 'I var lige gode. Godt kæmpet, begge to!'
    : iWon
      ? `Flot klaret! Du slog ${oppName} med ${pctText(mine.pct)} mod ${pctText(theirs.pct)}.`
      : `Godt kæmpet! Næste duel er din. ${oppName} fik ${pctText(theirs.pct)}, du fik ${pctText(mine.pct)}.`;

  return (
    <div className="duel-reveal" role="dialog" aria-modal="true" aria-label="Duellen er afgjort">
      <button className="dr-skip" onClick={close}>{phase === 'result' ? 'Luk' : 'Spring over'}</button>
      <div className="dr-head">
        <div className="pixel dr-title">Duellen er afgjort</div>
        <div className="dr-vs">
          <span className="dr-name me">{label(me.id)}</span>
          <span className="pixel">VS</span>
          <span className="dr-name opp">{label(oppId)}</span>
        </div>
      </div>
      <div className="dr-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="dr-canvas" />
        <span ref={powRef} className="dr-pow pixel" aria-hidden="true" />
      </div>
      {phase === 'result' && (
        <div className={`dr-result ${iWon ? 'won' : tie ? 'tie' : 'lost'}`}>
          {iWon && (
            <div className="confetti" aria-hidden="true">
              {Array.from({ length: 36 }, (_, i) => <i key={i} style={{ '--i': i }} />)}
            </div>
          )}
          <div className="pixel dr-headline">{headline}</div>
          <p>{sub}</p>
          <div className="dr-scores">
            {[[me.id, mine, 'me'], [oppId, theirs, 'opp']].map(([id, s, cls]) => (
              <div key={id} className={`dr-score ${cls} ${duel.winner_id === id ? 'winner' : ''}`}>
                <strong>{id === me.id ? 'Dig' : oppName}</strong>
                <span className="pixel">{pctText(s.pct)}</span>
                <small>{s.days} af {s.target} dage · {Math.round(s.xp)} XP</small>
              </div>
            ))}
          </div>
          <button className="btn primary big pixel" onClick={close}>Fortsæt</button>
        </div>
      )}
    </div>
  );
}

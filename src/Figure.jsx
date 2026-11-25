import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { THREE, buildScene, makeCamera, disposeScene, snapshot } from './voxel.js';

// Figuren tegnes i lav opløsning og skaleres op uden udglatning: 3D med pixel-look.
const PIXEL = 3;


function StaticFigure({ appearance, items, stats, angle, size, decay = 0 }) {
  const itemsById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const px = Math.round(size < 100 ? size * dpr : (size * dpr) / PIXEL);
  const url = useMemo(
    () => snapshot({ appearance, itemsById, stats, angle, px, decay }),
    [appearance, itemsById, stats, angle, px, decay]
  );
  return (
    <div className="figure-stage" style={{ width: size, height: size }}>
      {url ? <img className="figure-img" src={url} alt="" draggable="false" /> : <span className="figure-fallback">Figur</span>}
    </div>
  );
}

function InteractiveFigure({ appearance, items, stats, size, decay = 0 }) {
  const canvasRef = useRef(null);
  const state = useRef({ angle: 0, target: 0, drag: null, renderer: null, scene: null, character: null, camera: null, raf: 0, spin: false });
  const [spinning, setSpinning] = useState(false);
  const [failed, setFailed] = useState(false);
  const itemsById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  const draw = () => {
    const s = state.current;
    if (!s.renderer || !s.scene) return;
    s.character.rotation.y = (s.angle * Math.PI) / 180;
    s.renderer.render(s.scene, s.camera);
  };

  const loop = () => {
    const s = state.current;
    if (s.spin) s.target += 0.6;
    const diff = s.target - s.angle;
    s.angle = Math.abs(diff) < 0.05 ? s.target : s.angle + diff * 0.18;
    draw();
    if (s.spin || s.drag || s.angle !== s.target) s.raf = requestAnimationFrame(loop);
    else s.raf = 0;
  };
  const kick = () => {
    if (!state.current.raf) state.current.raf = requestAnimationFrame(loop);
  };

  // Renderer
  useEffect(() => {
    const s = state.current;
    try {
      s.renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: false });
      s.renderer.setPixelRatio(1);
      s.camera = makeCamera(1);
    } catch {
      setFailed(true);
      return undefined;
    }
    return () => {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      if (s.scene) disposeScene(s.scene);
      s.renderer.dispose();
      s.renderer = null;
    };
  }, []);

  // Størrelse
  useEffect(() => {
    const s = state.current;
    if (!s.renderer) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.round((size * dpr) / PIXEL);
    s.renderer.setSize(px, px, false);
    draw();
  }, [size]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scene: bygges om når udstyr eller krop ændres
  useEffect(() => {
    const s = state.current;
    if (!s.renderer) return;
    if (s.scene) disposeScene(s.scene);
    const built = buildScene(appearance, itemsById, stats, decay);
    s.scene = built.scene;
    s.character = built.character;
    draw();
  }, [appearance, itemsById, stats, decay]); // eslint-disable-line react-hooks/exhaustive-deps

  const rotateBy = (deg) => {
    const s = state.current;
    s.spin = false;
    setSpinning(false);
    s.target = Math.round((s.target + deg) / 45) * 45;
    kick();
  };

  const toggleSpin = () => {
    const s = state.current;
    s.spin = !s.spin;
    setSpinning(s.spin);
    if (!s.spin) s.target = Math.round(s.angle / 45) * 45;
    kick();
  };

  const onDown = (e) => {
    const s = state.current;
    s.spin = false;
    setSpinning(false);
    s.drag = { x: e.clientX, start: s.target };
    e.currentTarget.setPointerCapture(e.pointerId);
    kick();
  };
  const onMove = (e) => {
    const s = state.current;
    if (!s.drag) return;
    s.target = s.drag.start + (e.clientX - s.drag.x) * 1.2;
  };
  const onUp = () => {
    state.current.drag = null;
    kick();
  };

  if (failed) {
    return <div className="figure-stage" style={{ width: size, height: size }}><span className="figure-fallback">3D virker ikke i denne browser</span></div>;
  }

  return (
    <div className="figure-wrap">
      <div className="figure-stage grab" style={{ width: size, height: size }}>
        <canvas
          ref={canvasRef}
          className="figure-canvas"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label="Din figur. Træk til siden for at dreje den."
        />
      </div>
      <div className="rotate">
        <button className="iconbtn" onClick={() => rotateBy(-45)} aria-label="Drej til venstre"><ChevronLeft /></button>
        <button className="iconbtn" onClick={() => rotateBy(45)} aria-label="Drej til højre"><ChevronRight /></button>
        <button className={`iconbtn ${spinning ? 'active' : ''}`} onClick={toggleSpin} aria-label="Snur rundt"><RotateCw size={20} /></button>
      </div>
      <p className="sub small hint">Træk i figuren for at dreje den hele vejen rundt.</p>
    </div>
  );
}

export default function Figure({ interactive = false, angle = 0, size = 220, ...rest }) {
  return interactive ? <InteractiveFigure size={size} {...rest} /> : <StaticFigure angle={angle} size={size} {...rest} />;
}

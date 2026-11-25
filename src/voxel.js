// 3D-figur bygget af klodser (voxel-stil) med three.js.
// Mål er i "pixels": hoved 8, krop 12 høj, arme og ben 12 lange (som klassiske klodsfigurer).
import * as THREE from 'three';

const SKIN = 0xe0b48e;
const SKIN_DARK = 0xc98f63;
const HAIR = 0x5a3a22;
const PANTS = 0x2a2d3a;

const hex = (c) => (typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16));
function shade(c, amt) {
  const n = hex(c);
  const k = (v) => Math.max(0, Math.min(255, v + amt));
  return (k(n >> 16) << 16) | (k((n >> 8) & 255) << 8) | k(n & 255);
}

const matCache = new Map();
const sharedMats = new Set();
function mat(color) {
  const key = hex(color);
  if (!matCache.has(key)) {
    const m = new THREE.MeshLambertMaterial({ color: key });
    matCache.set(key, m);
    sharedMats.add(m);
  }
  return matCache.get(key);
}

function box(group, w, h, d, x, y, z, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  group.add(m);
  return m;
}

export function bodyShape(appearance, stats, decay = 0) {
  const stage = Number(String(appearance.body || 'body_1').split('_')[1]) || 1;
  // Uden træning svinder musklerne; XP og trin bevares.
  const muscle = Math.min((stats?.strength || 0) / 1500, 1) * (1 - 0.4 * decay);
  const lean = Math.min((stats?.stamina || 0) / 1500, 1);
  let torsoW = 8 + Math.floor((stage - 1) / 2) + (muscle > 0.5 ? 1 : 0);
  if (lean > 0.6 && muscle < 0.3) torsoW -= 1;
  // Dårlig form: kroppen bliver bredere og blødere
  if (decay >= 2) torsoW += decay - 1;
  return {
    torsoW: Math.max(7, Math.min(torsoW, 12)),
    torsoD: 4 + (stage >= 4 ? 1 : 0),
    armT: 4 + ((muscle > 0.6 || stage >= 3) && decay < 2 ? 1 : 0),
    muscle,
    decay,
  };
}

export function buildCharacter(appearance, itemsById, stats, decay = 0) {
  const g = new THREE.Group();
  const { torsoW, torsoD, armT, muscle } = bodyShape(appearance, stats, decay);
  const color = (slot) => itemsById[appearance[slot]]?.color;
  const armX = torsoW / 2 + armT / 2;

  // Ben og bukser
  for (const s of [-1, 1]) box(g, 3.7, 12, 4, s * 2.1, 6, 0, PANTS);
  box(g, torsoW + 0.1, 1, torsoD + 0.1, 0, 12.5, 0, shade(PANTS, 25)); // bukselinning

  // Krop og arme (hud), hoved
  box(g, torsoW, 11, torsoD, 0, 18.5, 0, SKIN);
  for (const s of [-1, 1]) {
    box(g, armT, 12, armT, s * armX, 18, 0, SKIN);
    if (muscle > 0.3) box(g, armT + 0.15, 2, armT + 0.15, s * armX, 20, 0, SKIN_DARK); // biceps
  }
  // Hovedet hænger lidt, når formen er dårlig
  const head = new THREE.Group();
  head.position.set(0, decay >= 3 ? -0.7 : decay >= 2 ? -0.4 : 0, decay >= 3 ? 1.1 : decay >= 2 ? 0.6 : 0);
  g.add(head);
  box(head, 8, 8, 8, 0, 28, 0, SKIN);

  // Ansigt (foran = +z)
  const fz = 4.05;
  for (const s of [-1, 1]) {
    box(head, 2, 1.4, 0.2, s * 2, 28.6, fz, 0xffffff);
    box(head, 1, 1.4, 0.3, s * 1.5, 28.6, fz + 0.02, 0x15161a);
    if (decay >= 2) {
      box(head, 2.1, 0.8, 0.35, s * 2, 29, fz + 0.05, SKIN_DARK); // trætte øjenlåg
      box(head, 2, 0.5, 0.25, s * 2, 27.7, fz, 0xb07a55); // rander under øjnene
    }
    box(head, 2, 0.5, 0.2, s * 2, decay >= 2 ? 29.7 : 30, fz, HAIR); // øjenbryn
  }
  box(head, 1, 1, 0.4, 0, 27.4, fz + 0.1, SKIN_DARK); // næse
  if (decay >= 2) {
    box(head, 2, 0.6, 0.2, 0, 26.1, fz, 0x9a5b3c); // sur mund
    for (const s of [-1, 1]) box(head, 0.6, 0.6, 0.2, s * 1.2, 25.7, fz, 0x9a5b3c);
  } else {
    box(head, 3, 0.6, 0.2, 0, 25.9, fz, 0x9a5b3c); // smil
    if (decay === 0) for (const s of [-1, 1]) box(head, 0.6, 0.6, 0.2, s * 1.7, 26.3, fz, 0x9a5b3c);
  }

  if (decay >= 3) box(head, 6, 1, 3, 0, 23.7, 2.4, SKIN_DARK); // dobbelthage

  // Hår
  box(head, 8.3, 1.6, 8.3, 0, 31.3, 0, HAIR);
  box(head, 8.3, 5, 0.5, 0, 29.2, -4.05, HAIR);
  for (const s of [-1, 1]) box(head, 0.5, 3, 6, s * 4.05, 30, -1, HAIR);

  // Mave, når formen falder
  const belly = decay >= 2 ? (decay - 1) * 1.4 : 0;
  if (belly) box(g, torsoW - 1, 5.5, belly, 0, 16, torsoD / 2 + belly / 2, SKIN);

  // Trøje: dækker kroppen og overarmene hele vejen rundt
  const top = color('top');
  if (top) {
    const dark = shade(top, -45);
    box(g, torsoW + 0.5, 11.4, torsoD + 0.5, 0, 18.6, 0, top);
    box(g, torsoW + 0.6, 0.8, torsoD + 0.6, 0, 13.3, 0, dark); // kant forneden
    if (belly) box(g, torsoW - 0.5, 6, belly + 0.5, 0, 16, torsoD / 2 + belly / 2 + 0.15, top);
    box(g, 3, 0.7, 0.2, 0, 23.9, torsoD / 2 + 0.3, dark); // krave foran
    for (const s of [-1, 1]) {
      box(g, armT + 0.5, 5.4, armT + 0.5, s * armX, 21.5, 0, top); // ærme
      box(g, armT + 0.6, 0.7, armT + 0.6, s * armX, 19.1, 0, dark); // ærmekant
    }
    if (appearance.top === 'top_mester' || appearance.top === 'top_styrke') {
      box(g, 1.2, 10.6, 0.2, 0, 18.7, torsoD / 2 + 0.3, dark); // stribe foran
      box(g, 1.2, 10.6, 0.2, 0, 18.7, -torsoD / 2 - 0.3, dark); // og bagpå
    }
  }

  // Sko
  const shoes = color('shoes');
  if (shoes) {
    for (const s of [-1, 1]) {
      box(g, 4.3, 2.6, 5.6, s * 2.15, 1.6, 0.6, shoes);
      box(g, 4.4, 0.6, 5.7, s * 2.15, 0.3, 0.6, shade(shoes, -60)); // sål
      box(g, 4.4, 0.5, 0.2, s * 2.15, 2.2, 3.45, 0xf8fafc); // snørebånd
    }
  }

  // Armbånd
  const arm = color('armband');
  if (arm) for (const s of [-1, 1]) box(g, armT + 0.6, 1.2, armT + 0.6, s * armX, 14.8, 0, arm);

  // Pandebånd
  const hb = color('headband');
  if (hb) box(head, 8.7, 1.3, 8.7, 0, 30.4, 0, hb);

  // Hatte
  const hat = color('hat');
  if (hat) {
    const id = appearance.hat;
    if (id === 'hat_krone') {
      box(head, 8.6, 2, 0.6, 0, 33, 4, hat);
      box(head, 8.6, 2, 0.6, 0, 33, -4, hat);
      box(head, 0.6, 2, 8.6, 4, 33, 0, hat);
      box(head, 0.6, 2, 8.6, -4, 33, 0, hat);
      for (const x of [-3.5, 0, 3.5]) {
        box(head, 1.2, 1.4, 0.6, x, 34.6, 4, hat);
        box(head, 1.2, 1.4, 0.6, x, 34.6, -4, hat);
      }
      for (const z of [-3.5, 0, 3.5]) {
        box(head, 0.6, 1.4, 1.2, 4, 34.6, z, hat);
        box(head, 0.6, 1.4, 1.2, -4, 34.6, z, hat);
      }
      box(head, 1.2, 1.2, 0.3, 0, 33, 4.35, 0xe8553d);
    } else if (id === 'hat_hue') {
      box(head, 8.8, 4, 8.8, 0, 32, 0, hat);
      box(head, 9, 1.4, 9, 0, 30.4, 0, shade(hat, 70));
      box(head, 2.4, 2.4, 2.4, 0, 35, 0, 0xf8fafc);
    } else {
      box(head, 8.7, 2.4, 8.7, 0, 32.4, 0, hat);
      box(head, 7.6, 0.6, 3.6, 0, 31.4, 6, shade(hat, -20));
      box(head, 1.2, 0.8, 1.2, 0, 34, 0, shade(hat, 40));
    }
  }
  return g;
}

// Små scener til baggrundene
function rand(seed) {
  let s = seed;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

export function buildBackdrop(bgId, bgColor) {
  const g = new THREE.Group();
  const ground = shade(bgColor, -35);
  box(g, 90, 2, 90, 0, -1, 0, ground);
  const r = rand(bgId.length * 17 + 3);

  if (bgId === 'bg_skovsti') {
    box(g, 9, 0.2, 90, 0, 0.05, 0, 0xd9c49a);
    for (const [x, z, h] of [[-15, -10, 7], [16, -14, 9], [-22, -26, 10], [24, -30, 8], [-9, -34, 6], [7, -40, 10]]) {
      box(g, 2.5, h, 2.5, x, h / 2, z, 0x7a4e2d);
      box(g, 8, 6, 8, x, h + 2, z, 0x3f9d6a);
      box(g, 5, 3, 5, x, h + 6, z, 0x57b97f);
    }
  } else if (bgId === 'bg_stadion') {
    box(g, 90, 0.2, 18, 0, 0.05, -2, 0xc0503a);
    for (const z of [-9, -4, 1, 6]) box(g, 90, 0.25, 0.5, 0, 0.1, z, 0xffffff);
    box(g, 90, 6, 6, 0, 3, -26, 0x8b8f99);
    box(g, 90, 4, 6, 0, 8, -32, 0x6b7280);
    for (let i = 0; i < 26; i++) box(g, 1.6, 1.6, 1.6, -40 + i * 3.2, 7.2 + (i % 2), -25, [0x2f66f3, 0xe8553d, 0xf5c518][i % 3]);
  } else if (bgId === 'bg_bjergtop') {
    for (const [x, z, s] of [[-20, -26, 16], [8, -34, 24], [26, -22, 12], [-6, -44, 18]]) {
      box(g, s, s * 0.8, s, x, s * 0.4, z, 0x8b95a5);
      box(g, s * 0.55, s * 0.35, s * 0.55, x, s * 0.8 + s * 0.17, z, 0x9ca7b8);
      box(g, s * 0.3, s * 0.15, s * 0.3, x, s * 0.8 + s * 0.42, z, 0xffffff);
    }
    for (let i = 0; i < 8; i++) box(g, 2, 1.5, 2, (r() - 0.5) * 40, 0.75, 6 + r() * 12, 0x7b8494);
  } else if (bgId === 'bg_natby') {
    for (let i = 0; i < 9; i++) {
      const x = -36 + i * 9, h = 10 + r() * 22, z = -24 - r() * 12;
      box(g, 8, h, 8, x, h / 2, z, i % 2 ? 0x3b3d78 : 0x4a4c8c);
      for (let y = 3; y < h - 2; y += 4) {
        for (const wx of [-2, 2]) if (r() > 0.35) box(g, 1.4, 1.6, 0.2, x + wx, y, z + 4.05, 0xffd166);
      }
    }
    box(g, 4, 4, 4, 30, 40, -60, 0xf8fafc); // måne
  } else if (bgId === 'bg_ildhav') {
    for (let i = 0; i < 18; i++) {
      const s = 1.5 + r() * 3;
      box(g, s, 0.4, s, (r() - 0.5) * 70, 0.1, -6 - r() * 30, r() > 0.5 ? 0xff7a1a : 0xffc23d);
    }
    for (const [x, z, s] of [[-18, -20, 8], [20, -26, 11], [2, -38, 14]]) {
      box(g, s, s, s, x, s / 2, z, 0x3a2a2a);
      box(g, s * 0.4, 1, s * 0.4, x, s + 0.5, z, 0xff5a1f);
    }
  }
  return g;
}

export function buildScene(appearance, itemsById, stats, decay = 0) {
  const bgItem = itemsById[appearance.background];
  const bgColor = hex(bgItem?.color ?? '#dcefe2');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bgColor);
  scene.fog = new THREE.Fog(bgColor, 70, 140);

  scene.add(new THREE.HemisphereLight(0xffffff, shade(bgColor, -60), 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(25, 45, 35);
  scene.add(sun);

  scene.add(buildBackdrop(appearance.background || 'bg_skovsti', bgColor));

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(7, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.12;
  scene.add(shadow);

  const character = buildCharacter(appearance, itemsById, stats, decay);
  scene.add(character);
  return { scene, character };
}

export function makeCamera(aspect = 1) {
  const cam = new THREE.PerspectiveCamera(34, aspect, 1, 400);
  cam.position.set(0, 25, 76);
  cam.lookAt(0, 17, 0);
  return cam;
}

export function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !sharedMats.has(o.material)) o.material.dispose();
  });
}

// Én delt renderer til stillbilleder (små figurer), så vi ikke bruger mange WebGL-kontekster.
let shared = null;
function sharedRenderer() {
  if (shared) return shared;
  const canvas = document.createElement('canvas');
  shared = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  shared.setPixelRatio(1);
  return shared;
}

const snapCache = new Map();
export function snapshot({ appearance, itemsById, stats, angle = 0, px, decay = 0 }) {
  const shape = bodyShape(appearance, stats, decay);
  const key = JSON.stringify([appearance, shape, angle, px, Object.keys(itemsById).length]);
  if (snapCache.has(key)) return snapCache.get(key);
  let url = null;
  try {
    const renderer = sharedRenderer();
    renderer.setSize(px, px, false);
    const { scene, character } = buildScene(appearance, itemsById, stats, decay);
    character.rotation.y = (angle * Math.PI) / 180;
    renderer.render(scene, makeCamera(1));
    url = renderer.domElement.toDataURL('image/png');
    disposeScene(scene);
  } catch {
    url = null;
  }
  if (snapCache.size > 200) snapCache.clear();
  snapCache.set(key, url);
  return url;
}

export { THREE };

// Falsk Supabase i hukommelsen, kun til preview. Efterligner de regler databasen har.

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const daysAgo = (n, h = 18) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d; };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

const ME = 'u-mads';
const db = {
  profiles: [
    { id: ME, name: 'Mads Ulrich Pedersen', is_admin: true, created_at: '2026-11-24T10:00:00Z', weekly_goal: 3, pending_goal: null, pending_from: null, goal_set: false },
    { id: 'u-hanne', name: 'Hanne Pedersen', is_admin: false, created_at: '2026-11-24T11:00:00Z', weekly_goal: 4, pending_goal: null, pending_from: null, goal_set: true },
    { id: 'u-peter', name: 'Peter Pedersen', is_admin: false, created_at: '2026-11-24T12:00:00Z', weekly_goal: 2, pending_goal: null, pending_from: null, goal_set: true },
    { id: 'u-sofie', name: 'Sofie Pedersen', is_admin: false, created_at: '2026-11-24T13:00:00Z', weekly_goal: 3, pending_goal: null, pending_from: null, goal_set: true },
    { id: 'u-jonas', name: 'Jonas Pedersen', is_admin: false, created_at: '2026-11-24T14:00:00Z', weekly_goal: 2, pending_goal: null, pending_from: null, goal_set: true },
  ],
  settings: [{
    id: 1, xp_per_km_running: 10, xp_per_minute_strength: 1, xp_per_minute_other: 0.5, daily_xp_cap: 200,
    level_curve_base: 100, level_curve_exponent: 1.5, stage2_level: 5, stage3_level: 10, stage4_level: 20,
    stage5_level: 35, xp_per_km_walking: 4, xp_per_km_cycling: 3, xp_per_minute_swimming: 1, duel_duration_days: 7, max_active_duels: 1, max_players: 5, history_days: 60,
  }],
  allowed_emails: [
    { email: 'mulrichpedersen@gmail.com', created_at: '2026-11-24T10:00:00Z' },
    { email: 'hanne@eksempel.dk', created_at: '2026-11-24T10:01:00Z' },
    { email: 'peter@eksempel.dk', created_at: '2026-11-24T10:02:00Z' },
  ],
  items: [],
  characters: [
    { user_id: ME, name: 'Bobby', appearance: { background: 'bg_skovsti', body: 'body_1', shoes: 'shoes_gamle', top: 'top_traening', headband: 'hb_sved' } },
    { user_id: 'u-hanne', name: 'Turbo-Hanne', appearance: { background: 'bg_stadion', body: 'body_2', shoes: 'shoes_loeb', gender: 'pige', hair: 'blond', skin: 'lys', shirt: 'roed', pants: 'denim' } },
    { user_id: 'u-sofie', name: 'Lynet', appearance: { background: 'bg_skovsti', body: 'body_1', shoes: 'shoes_gamle', gender: 'pige', hair: 'sort', skin: 'gylden', shirt: 'groen', pants: 'graa' } },
    { user_id: 'u-jonas', name: 'Kaptajnen', appearance: { background: 'bg_skovsti', body: 'body_1', shoes: 'shoes_gamle', hair: 'roed', skin: 'lys', shirt: 'gul', pants: 'khaki' } },
    { user_id: 'u-peter', name: 'Bjørnen', appearance: { background: 'bg_skovsti', body: 'body_1', shoes: 'shoes_vaegt', top: 'top_styrke', hat: 'hat_kasket' } },
  ],
  workouts: [],
  duels: [],
  cheers: [],
};

const I = (id, name, slot, t, v, s, color) => ({ id, name, slot, unlock_type: t, unlock_value: v, stage_required: s, color });
db.items = [
  I('bg_skovsti', 'Skovsti', 'background', 'level', 1, 1, '#dcefe2'), I('bg_stadion', 'Stadion', 'background', 'level', 5, 1, '#f6d77a'),
  I('bg_bjergtop', 'Bjergtop', 'background', 'level', 10, 1, '#b9d6f2'), I('bg_natby', 'Natby', 'background', 'level', 20, 1, '#2b2d5c'),
  I('bg_ildhav', 'Ildhav', 'background', 'level', 35, 1, '#f08a5d'),
  I('body_1', 'Krop Trin 1', 'body', 'level', 1, 1, '#e0b48e'), I('body_2', 'Krop Trin 2', 'body', 'level', 5, 2, '#e0b48e'),
  I('body_3', 'Krop Trin 3', 'body', 'level', 10, 3, '#e0b48e'), I('body_4', 'Krop Trin 4', 'body', 'level', 20, 4, '#e0b48e'),
  I('body_5', 'Krop Trin 5', 'body', 'level', 35, 5, '#e0b48e'),
  I('shoes_gamle', 'Gamle sko', 'shoes', 'level', 1, 1, '#4b5563'), I('shoes_lyn', 'Lynsko', 'shoes', 'level', 10, 1, '#facc15'),
  I('shoes_vaegt', 'Vægtløftersko', 'shoes', 'strength_xp', 200, 1, '#7c2d12'), I('shoes_loeb', 'Løbesko', 'shoes', 'stamina_xp', 200, 1, '#ef4444'),
  I('top_traening', 'Træningstrøje', 'top', 'level', 1, 1, '#2f66f3'), I('top_mester', 'Mesterskabstrøje', 'top', 'level', 20, 1, '#f5c518'),
  I('top_loebetop', 'Løbetop', 'top', 'stamina_xp', 500, 1, '#22c55e'), I('top_styrke', 'Styrketrøje', 'top', 'strength_xp', 500, 1, '#e8553d'),
  I('hb_sved', 'Svedbånd', 'headband', 'level', 3, 1, '#f8fafc'), I('hb_pande', 'Pandebånd', 'headband', 'stamina_xp', 800, 1, '#06b6d4'),
  I('arm_basis', 'Armbånd', 'armband', 'level', 4, 1, '#9ca3af'), I('arm_jern', 'Jernarmbånd', 'armband', 'strength_xp', 800, 1, '#374151'),
  I('hat_kasket', 'Kasket', 'hat', 'level', 6, 1, '#1f2937'), I('hat_hue', 'Hue', 'hat', 'level', 8, 1, '#dc2626'),
  I('hat_krone', 'Krone', 'hat', 'level', 35, 1, '#facc15'),
];

function calcXp(w) {
  const s = db.settings[0];
  let raw;
  if (['running', 'walking', 'cycling'].includes(w.type)) {
    if (!(Number(w.distance_km) > 0)) throw new Error('Angiv en distance i km');
    raw = w.distance_km * { running: s.xp_per_km_running, walking: s.xp_per_km_walking, cycling: s.xp_per_km_cycling }[w.type];
  } else {
    if (!(Number(w.duration_minutes) > 0)) throw new Error('Angiv varighed i minutter');
    const rate = { strength: s.xp_per_minute_strength, swimming: s.xp_per_minute_swimming }[w.type] ?? s.xp_per_minute_other;
    raw = w.duration_minutes * rate;
  }
  let awarded = 0;
  if (w.proof_status === 'confirmed') {
    const used = db.workouts.filter((o) => o.user_id === w.user_id && o.workout_date === w.workout_date && o.id !== w.id)
      .reduce((a, o) => a + o.xp_awarded, 0);
    awarded = Math.max(Math.min(raw, s.daily_xp_cap - used), 0);
  }
  w.xp_awarded = Math.round(awarded * 10) / 10;
  w.xp_strength = w.type === 'strength' ? w.xp_awarded : 0;
  w.xp_stamina = w.type === 'strength' ? 0 : w.xp_awarded;
  return w;
}

function seedWorkout(user_id, n, type, extra) {
  let d = daysAgo(n);
  if (d > new Date()) d = new Date(Date.now() - 3600000);
  const w = { id: uid(), user_id, type, workout_date: iso(d), duration_minutes: null, distance_km: null, muscle_group: null,
    proof_path: null, proof_status: n >= 1 ? 'confirmed' : 'pending', created_at: d.toISOString(), ...extra };
  db.workouts.push(calcXp(w));
}
const dow = (new Date().getDay() + 6) % 7; // dage siden mandag
const n = (k) => Math.min(k, dow);
seedWorkout(ME, n(2), 'running', { distance_km: 8, duration_minutes: 44 });
seedWorkout(ME, n(1), 'strength', { duration_minutes: 45, muscle_group: 'Ben' });
seedWorkout(ME, 0, 'running', { distance_km: 5, duration_minutes: 29 });
seedWorkout('u-hanne', n(3), 'running', { distance_km: 10, duration_minutes: 58, proof_path: 'demo/loeb.svg' });
seedWorkout('u-hanne', n(1), 'cycling', { distance_km: 24, duration_minutes: 70 });
seedWorkout('u-peter', n(1), 'walking', { distance_km: 5.5, duration_minutes: 65 });
seedWorkout('u-peter', 9, 'strength', { duration_minutes: 60, muscle_group: 'Bryst' });
seedWorkout('u-peter', 5, 'running', { distance_km: 4, duration_minutes: 26 });
seedWorkout('u-sofie', n(1), 'running', { distance_km: 7, duration_minutes: 40 });
seedWorkout('u-sofie', n(2), 'swimming', { duration_minutes: 45 });
seedWorkout('u-jonas', n(1), 'cycling', { distance_km: 30, duration_minutes: 80 });
seedWorkout('u-jonas', n(2), 'walking', { distance_km: 6, duration_minutes: 70 });
seedWorkout('u-hanne', 0, 'running', { distance_km: 6.5, duration_minutes: 37, proof_path: 'demo/loeb.svg' });
seedWorkout('u-hanne', 0, 'strength', { duration_minutes: 40, muscle_group: 'Ryg', proof_status: 'pending', proof_path: 'demo/bevis.svg' });
db.duels.push({ id: uid(), challenger_id: 'u-hanne', opponent_id: ME, status: 'pending', created_at: new Date().toISOString() });
{
  const myRun = db.workouts.find((w) => w.user_id === ME && w.type === 'running' && w.proof_status === 'confirmed');
  if (myRun) db.cheers.push({ workout_id: myRun.id, user_id: 'u-hanne', comment: 'Flot tur, skat!', created_at: new Date().toISOString() });
  const hRide = db.workouts.find((w) => w.user_id === 'u-hanne' && w.type === 'cycling');
  if (hRide) db.cheers.push({ workout_id: hRide.id, user_id: 'u-peter', comment: null, created_at: new Date().toISOString() });
}
db.duels.push({ id: uid(), challenger_id: ME, opponent_id: 'u-peter', status: 'finished', start_at: daysAgo(12).toISOString(),
  end_at: daysAgo(5).toISOString(), challenger_xp: 310, opponent_xp: 255, winner_id: ME, challenger_goal: 3, opponent_goal: 2, challenger_days: 3, opponent_days: 1, created_at: daysAgo(12).toISOString() });
// Preview: tilføj ?uafgjort til adressen for at se en uafgjort duel (high five)
if (new URLSearchParams(location.search).has('uafgjort')) {
  Object.assign(db.duels[db.duels.length - 1], { winner_id: null, challenger_xp: 280, opponent_xp: 280, opponent_days: 2 });
}

const PROOF = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220"><rect width="400" height="220" fill="#dcefe2"/>` +
  `<rect x="60" y="120" width="280" height="14" rx="7" fill="#374151"/><rect x="40" y="95" width="36" height="64" rx="6" fill="#15161a"/>` +
  `<rect x="324" y="95" width="36" height="64" rx="6" fill="#15161a"/><text x="200" y="195" font-family="sans-serif" font-size="18" text-anchor="middle" fill="#5b6170">Eksempel på bevisbillede</text></svg>`);

const RUN = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 480"><rect width="360" height="480" fill="#ffffff"/>` +
  `<rect width="360" height="250" fill="#e9eef3"/><path d="M40 210 C 80 120, 140 190, 170 110 S 260 60, 310 140" stroke="#e8553d" stroke-width="6" fill="none"/>` +
  `<circle cx="40" cy="210" r="8" fill="#3f9d6a"/><circle cx="310" cy="140" r="8" fill="#15161a"/>` +
  `<text x="24" y="290" font-family="sans-serif" font-size="20" font-weight="700" fill="#15161a">Morgenløb</text>` +
  `<text x="24" y="340" font-family="sans-serif" font-size="14" fill="#5b6170">Distance</text><text x="24" y="368" font-family="sans-serif" font-size="26" font-weight="700" fill="#15161a">10,0 km</text>` +
  `<text x="190" y="340" font-family="sans-serif" font-size="14" fill="#5b6170">Tempo</text><text x="190" y="368" font-family="sans-serif" font-size="26" font-weight="700" fill="#15161a">5:48 /km</text>` +
  `<text x="24" y="420" font-family="sans-serif" font-size="14" fill="#5b6170">Tid</text><text x="24" y="448" font-family="sans-serif" font-size="26" font-weight="700" fill="#15161a">58:04</text>` +
  `<text x="190" y="420" font-family="sans-serif" font-size="14" fill="#5b6170">Eksempel</text><text x="190" y="448" font-family="sans-serif" font-size="16" fill="#5b6170">skærmbillede</text></svg>`);
const uploaded = new Map();

// ---------- Forespørgsels-bygger ----------
class Query {
  constructor(table) { this.table = table; this.op = 'select'; this.filters = []; this.payload = null; this.orderBy = null; this.lim = null; this.one = false; }
  select() { return this; }
  insert(p) { this.op = 'insert'; this.payload = p; return this; }
  upsert(p) { this.op = 'upsert'; this.payload = p; return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(col, val) { this.filters.push([col, val]); return this; }
  gte(col, val) { this.ranges = [...(this.ranges || []), [col, val]]; return this; }
  order(col, { ascending = true } = {}) { this.orderBy = [col, ascending]; return this; }
  limit(n) { this.lim = n; return this; }
  single() { this.one = true; return this; }
  match(row) {
    return this.filters.every(([c, v]) => row[c] === v) && (this.ranges || []).every(([c, v]) => String(row[c]) >= String(v));
  }
  run() {
    const rows = db[this.table];
    if (this.op === 'insert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const p of list) {
        const row = { created_at: new Date().toISOString(), ...structuredClone(p) };
        if (this.table === 'workouts') { row.id ||= uid(); calcXp(row); }
        if (this.table === 'allowed_emails' && rows.some((r) => r.email === row.email)) return { data: null, error: { code: '23505', message: 'findes allerede' } };
        rows.push(row);
      }
      return { data: null, error: null };
    }
    if (this.op === 'upsert') {
      const row = { created_at: new Date().toISOString(), ...structuredClone(this.payload) };
      const i = rows.findIndex((r) => r.workout_id === row.workout_id && r.user_id === row.user_id);
      if (i >= 0) rows[i] = { ...rows[i], ...row }; else rows.push(row);
      return { data: null, error: null };
    }
    if (this.op === 'update') { rows.filter((r) => this.match(r)).forEach((r) => Object.assign(r, structuredClone(this.payload))); return { data: null, error: null }; }
    if (this.op === 'delete') { db[this.table] = rows.filter((r) => !this.match(r)); return { data: null, error: null }; }
    let out = rows.filter((r) => this.match(r)).map((r) => structuredClone(r));
    if (this.orderBy) {
      const [c, asc] = this.orderBy;
      out.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
    }
    if (this.lim) out = out.slice(0, this.lim);
    return { data: this.one ? out[0] ?? null : out, error: null };
  }
  then(res, rej) {
    try { return Promise.resolve(this.run()).then(res, rej); }
    catch (e) { return Promise.resolve({ data: null, error: { message: e.message } }).then(res, rej); }
  }
}

const activeFor = (p) => db.duels.filter((d) => d.status === 'active' && (d.challenger_id === p || d.opponent_id === p)).length;
const sumIn = (u, d) => db.workouts.filter((w) => w.user_id === u && new Date(w.created_at) >= new Date(d.start_at) && new Date(w.created_at) < new Date(d.end_at))
  .reduce((a, w) => a + w.xp_awarded, 0);

const effGoal = (id) => {
  const p = db.profiles.find((x) => x.id === id);
  return p.pending_goal && p.pending_from <= iso(new Date()) ? p.pending_goal : p.weekly_goal;
};
const trainDays = (u, from, to) => new Set(db.workouts.filter((w) => w.user_id === u && w.proof_status !== 'rejected'
  && ((w.duration_minutes || 0) >= 15 || (w.distance_km || 0) >= 2)
  && new Date(w.created_at) >= new Date(from) && new Date(w.created_at) < new Date(to)).map((w) => w.workout_date)).size;

const rpcs = {
  touch_seen() {},
  set_weekly_goal({ p_goal }) {
    const p = db.profiles.find((x) => x.id === ME);
    if (!(p_goal >= 1 && p_goal <= 7)) throw new Error('Ugemålet skal være mellem 1 og 7 dage');
    if (!p.goal_set) { Object.assign(p, { weekly_goal: p_goal, goal_set: true, pending_goal: null, pending_from: null }); return; }
    const today = new Date();
    const next = new Date(today); next.setDate(today.getDate() + (8 - (((today.getDay() + 6) % 7) + 1)));
    if (p_goal === effGoal(ME)) Object.assign(p, { pending_goal: null, pending_from: null });
    else Object.assign(p, { pending_goal: p_goal, pending_from: iso(next) });
  },
  player_stats() {
    return db.profiles.map((p) => {
      const ws = db.workouts.filter((w) => w.user_id === p.id);
      const last = ws.filter((w) => w.proof_status !== 'rejected').reduce((m, w) => (w.workout_date > m ? w.workout_date : m), '');
      return {
        user_id: p.id,
        // Lidt ekstra XP fra "før de 2 måneder", så man kan se at gamle pas stadig tæller.
        total: ws.reduce((a, w) => a + w.xp_awarded, 0) + (p.id === 'u-peter' ? 400 : 0),
        stamina: ws.reduce((a, w) => a + w.xp_stamina, 0) + (p.id === 'u-peter' ? 150 : 0),
        strength: ws.reduce((a, w) => a + w.xp_strength, 0) + (p.id === 'u-peter' ? 250 : 0),
        last_workout: last || null,
      };
    });
  },
  confirm_workout({ p_id, p_decision }) {
    const w = db.workouts.find((x) => x.id === p_id);
    if (!w) throw new Error('træningen findes ikke');
    if (w.user_id === ME) throw new Error('du kan ikke bekræfte din egen træning');
    if (w.proof_status !== 'pending') throw new Error('træningen er allerede afgjort');
    Object.assign(w, { proof_status: p_decision, confirmed_by: ME, confirmed_at: new Date().toISOString() });
    calcXp(w);
  },
  challenge_player({ p_opponent }) {
    const lim = db.settings[0].max_active_duels;
    if (activeFor(ME) >= lim) throw new Error('du er allerede i en duel');
    if (activeFor(p_opponent) >= lim) throw new Error('modstanderen er allerede i en duel');
    db.duels.unshift({ id: uid(), challenger_id: ME, opponent_id: p_opponent, status: 'pending', created_at: new Date().toISOString() });
  },
  accept_duel({ p_id }) {
    const d = db.duels.find((x) => x.id === p_id);
    if (!d || d.status !== 'pending' || d.opponent_id !== ME) throw new Error('duellen kan ikke accepteres');
    if (activeFor(d.challenger_id) || activeFor(d.opponent_id)) throw new Error('en af jer er allerede i en duel');
    const now = new Date();
    Object.assign(d, { status: 'active', start_at: now.toISOString(), end_at: new Date(now.getTime() + db.settings[0].duel_duration_days * 86400000).toISOString(),
      challenger_goal: effGoal(d.challenger_id), opponent_goal: effGoal(d.opponent_id) });
  },
  decline_duel({ p_id }) {
    const d = db.duels.find((x) => x.id === p_id);
    if (d && d.status === 'pending') d.status = 'declined';
  },
  settle_duel({ p_id }) {
    const d = db.duels.find((x) => x.id === p_id);
    if (!d || d.status !== 'active' || new Date() < new Date(d.end_at)) return;
    const waiting = db.workouts.some((w) => [d.challenger_id, d.opponent_id].includes(w.user_id) && w.proof_status === 'pending'
      && new Date(w.created_at) >= new Date(d.start_at) && new Date(w.created_at) < new Date(d.end_at));
    if (waiting) return;
    const cx = sumIn(d.challenger_id, d), ox = sumIn(d.opponent_id, d);
    Object.assign(d, { status: 'finished', challenger_xp: cx, opponent_xp: ox, winner_id: cx > ox ? d.challenger_id : ox > cx ? d.opponent_id : null });
  },
};

const session = { user: { id: ME, email: 'mulrichpedersen@gmail.com' } };
let loggedIn = true;
const listeners = new Set();

export const configured = true;
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: loggedIn ? session : null } }),
    onAuthStateChange: (cb) => { listeners.add(cb); return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }; },
    signOut: async () => { loggedIn = false; listeners.forEach((cb) => cb('SIGNED_OUT', null)); return { error: null }; },
    signInWithPassword: async () => { loggedIn = true; listeners.forEach((cb) => cb('SIGNED_IN', session)); return { data: { session }, error: null }; },
    signUp: async () => ({ data: null, error: { message: 'Oprettelse er slået fra i preview.' } }),
  },
  from: (table) => new Query(table),
  functions: { invoke: async () => ({ data: { sent: 0 }, error: null }) },
  rpc: async (name, args) => {
    try { const data = rpcs[name](args); return { data: data ?? null, error: null }; }
    catch (e) { return { data: null, error: { message: e.message } }; }
  },
  storage: {
    from: () => ({
      upload: async (path, file) => { uploaded.set(path, URL.createObjectURL(file)); return { data: {}, error: null }; },
      remove: async () => ({ data: {}, error: null }),
      createSignedUrl: async (path) => ({
        data: { signedUrl: uploaded.get(path) ?? (path === 'demo/loeb.svg' ? RUN : PROOF) }, error: null,
      }),
    }),
  },
};

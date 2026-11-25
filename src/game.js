// Spilregler på klientsiden. XP beregnes i databasen; niveau, trin og udlåsning her.

export const TYPE_LABELS = {
  running: 'Løb', walking: 'Gåtur', cycling: 'Cykling', swimming: 'Svømning', strength: 'Styrke', other: 'Andet',
};
export const TYPE_HINTS = {
  running: 'Km + minutter', walking: 'Km + minutter', cycling: 'Km + minutter',
  swimming: 'Minutter', strength: 'Minutter + muskelgruppe', other: 'Minutter',
};
export const DISTANCE_TYPES = ['running', 'walking', 'cycling'];
// Skridt fra telefonens Sundhed-app (kommer automatisk via en genvej, logges ikke i hånden)
export const typeLabel = (t) => TYPE_LABELS[t] ?? (t === 'steps' ? 'Skridt' : t);
const isActiveDay = (w, s) => w.type !== 'steps' || Number(w.steps) >= (s?.steps_form_min || 6000);
export const isDistanceType = (t) => DISTANCE_TYPES.includes(t);

export const SLOTS = ['background', 'body', 'shoes', 'top', 'headband', 'armband', 'hat'];
export const SLOT_LABELS = {
  background: 'Baggrund', body: 'Krop', shoes: 'Sko', top: 'Tøj',
  headband: 'Pandebånd', armband: 'Armbånd', hat: 'Hat',
};

export const STAGE_NAMES = ['Nybegynder', 'Amatør', 'Øvet', 'Erfaren', 'Mester'];

export const DEFAULT_APPEARANCE = {
  background: 'bg_skovsti', body: 'body_1', shoes: 'shoes_gamle', top: 'top_traening',
};

// Frit udseende: kan vælges uanset niveau (gemmes i characters.appearance som gender/hair/skin/shirt/pants).
export const LOOK = {
  gender: [{ id: 'dreng', name: 'Dreng' }, { id: 'pige', name: 'Pige' }],
  hair: [
    { id: 'sort', name: 'Sort', color: '#1f1b18' },
    { id: 'brun', name: 'Brun', color: '#5a3a22' },
    { id: 'lysbrun', name: 'Lysebrun', color: '#9a6a3c' },
    { id: 'blond', name: 'Blond', color: '#e3c16f' },
    { id: 'roed', name: 'Rød', color: '#b4492a' },
    { id: 'graa', name: 'Grå', color: '#b9b9b4' },
  ],
  skin: [
    { id: 'lys', name: 'Lys', color: '#f3d2b6' },
    { id: 'mellem', name: 'Mellem', color: '#e0b48e' },
    { id: 'gylden', name: 'Gylden', color: '#c68b5c' },
    { id: 'brun', name: 'Brun', color: '#8d5a3b' },
    { id: 'moerk', name: 'Mørk', color: '#5c3a26' },
  ],
  shirt: [
    { id: 'blaa', name: 'Blå', color: '#2f66f3' },
    { id: 'roed', name: 'Rød', color: '#e8553d' },
    { id: 'groen', name: 'Grøn', color: '#3f9d6a' },
    { id: 'gul', name: 'Gul', color: '#f5c518' },
  ],
  pants: [
    { id: 'marine', name: 'Marineblå', color: '#2a2d3a' },
    { id: 'denim', name: 'Cowboy', color: '#3f5f8f' },
    { id: 'graa', name: 'Grå', color: '#7b7f88' },
    { id: 'khaki', name: 'Khaki', color: '#a8916a' },
  ],
};
export const LOOK_DEFAULTS = { gender: 'dreng', hair: 'brun', skin: 'mellem', shirt: 'blaa', pants: 'marine' };
export const lookOf = (appearance, key) => {
  const list = LOOK[key];
  return list.find((o) => o.id === appearance?.[key]) || list.find((o) => o.id === LOOK_DEFAULTS[key]);
};

export function normalizeSettings(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) out[k] = typeof v === 'number' ? v : Number(v);
  return out;
}

// Niveau N (N >= 2) kræver grundtal * N^eksponent samlet XP.
export function xpForLevel(level, s) {
  if (level <= 1) return 0;
  return Math.round(s.level_curve_base * Math.pow(level, s.level_curve_exponent));
}

export function levelFromXp(totalXp, s) {
  let level = 1;
  while (level < 999 && totalXp >= xpForLevel(level + 1, s)) level++;
  return level;
}

export function stageFromLevel(level, s) {
  if (level >= s.stage5_level) return 5;
  if (level >= s.stage4_level) return 4;
  if (level >= s.stage3_level) return 3;
  if (level >= s.stage2_level) return 2;
  return 1;
}

export function sumXp(workouts, userId, { from, to } = {}) {
  return workouts.reduce(
    (acc, w) => {
      if (w.user_id !== userId) return acc;
      const t = new Date(w.created_at);
      if (from && t < from) return acc;
      if (to && t >= to) return acc;
      acc.stamina += Number(w.xp_stamina) || 0;
      acc.strength += Number(w.xp_strength) || 0;
      acc.total += Number(w.xp_awarded) || 0;
      return acc;
    },
    { stamina: 0, strength: 0, total: 0 }
  );
}

// statsById: samlet XP for alle tider fra serveren (player_stats), så gamle pas tæller med.
export function playerInfo(profile, workouts, settings, statsById) {
  const row = statsById?.[profile.id];
  const stats = row
    ? { total: Number(row.total) || 0, stamina: Number(row.stamina) || 0, strength: Number(row.strength) || 0 }
    : sumXp(workouts, profile.id);
  const level = levelFromXp(stats.total, settings);
  const stage = stageFromLevel(level, settings);
  const form = formInfo(workouts.filter((w) => isActiveDay(w, settings)), profile, row?.last_workout);
  return { ...profile, stats, level, stage, form, decay: form.level };
}

export function isUnlocked(item, stats, level, stage) {
  if (stage < Number(item.stage_required)) return false;
  const v = item.unlock_type === 'level' ? level : item.unlock_type === 'stamina_xp' ? stats.stamina : stats.strength;
  return v >= Number(item.unlock_value);
}

export function unlockText(item) {
  const v = Number(item.unlock_value);
  const req =
    item.unlock_type === 'level' ? `Niveau ${v}` : item.unlock_type === 'stamina_xp' ? `${v} udholdenheds-XP` : `${v} styrke-XP`;
  return `${req} · trin ${item.stage_required}`;
}

export function localISO(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function startOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
}

export function daysLeft(endIso) {
  return Math.max(0, Math.ceil((new Date(endIso) - new Date()) / 86400000));
}

const MONTHS = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'];
export function shortDate(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d}. ${MONTHS[m - 1]}`;
}

export function firstName(name) {
  return (name || '').split(' ')[0];
}

// ---------- Form: falder uden træning, kommer straks tilbage efter én træning ----------
export const FORM = [
  { label: 'Topform', text: 'Klar til alt!' },
  { label: 'Lidt sløv', text: 'Begynder at blive rastløs.' },
  { label: 'Ude af form', text: 'Musklerne svinder, og maven vokser.' },
  { label: 'Sofakartoffel', text: 'Har ikke set dagslys længe.' },
];

export function formLevel(days) {
  if (days >= 7) return 3;
  if (days >= 4) return 2;
  if (days >= 2) return 1;
  return 0;
}

const dayNum = (iso) => Date.parse(iso + 'T00:00:00Z') / 86400000;

export function daysSinceTraining(workouts, profile, knownLast = null) {
  const mine = workouts.filter((w) => w.user_id === profile.id && w.proof_status !== 'rejected');
  const last = mine.reduce((m, w) => (w.workout_date > m ? w.workout_date : m), knownLast || '');
  const from = last || (profile.created_at ? localISO(new Date(profile.created_at)) : localISO());
  return Math.max(0, Math.round(dayNum(localISO()) - dayNum(from)));
}

export function formInfo(workouts, profile, knownLast = null) {
  const days = daysSinceTraining(workouts, profile, knownLast);
  const level = formLevel(days);
  return { days, level, ...FORM[level] };
}

// Afventende pas bliver automatisk bekræftet efter 3 dage.
export const AUTO_CONFIRM_DAYS = 3;
export function autoConfirmText(w) {
  const left = AUTO_CONFIRM_DAYS * 86400000 - (Date.now() - new Date(w.created_at).getTime());
  if (left <= 0) return 'bekræftes automatisk inden for en time';
  const hours = Math.ceil(left / 3600000);
  if (hours < 24) return `automatisk om ${hours} ${hours === 1 ? 'time' : 'timer'}`;
  const days = Math.ceil(hours / 24);
  return `automatisk om ${days} ${days === 1 ? 'dag' : 'dage'}`;
}

// XP et pas vil give, før dagens loft (bruges til at vise afventende XP).
export function rawXp(w, s) {
  const km = Number(w.distance_km) || 0;
  const m = Number(w.duration_minutes) || 0;
  switch (w.type) {
    case 'steps': return Math.min(Math.floor((Number(w.steps) || 0) / 1000) * (s.xp_per_1000_steps ?? 2), s.steps_max_xp ?? 20);
    case 'running': return km * s.xp_per_km_running;
    case 'walking': return km * s.xp_per_km_walking;
    case 'cycling': return km * s.xp_per_km_cycling;
    case 'swimming': return m * s.xp_per_minute_swimming;
    case 'strength': return m * s.xp_per_minute_strength;
    default: return m * s.xp_per_minute_other;
  }
}

// ---------- Ugemål: træningsdage pr. uge ----------
export const MIN_MINUTES = 15;
export const MIN_KM = 2;
export const qualifies = (w) =>
  w.proof_status !== 'rejected' && ((Number(w.duration_minutes) || 0) >= MIN_MINUTES || (Number(w.distance_km) || 0) >= MIN_KM);

export function effectiveGoal(profile) {
  if (profile.pending_goal && profile.pending_from && profile.pending_from <= localISO()) return profile.pending_goal;
  return profile.weekly_goal || 3;
}

// Træningsdage i denne uge (mandag–søndag) og hvilke ugedage.
export function weekProgress(workouts, profile) {
  const start = localISO(startOfWeek());
  const days = new Set(
    workouts.filter((w) => w.user_id === profile.id && w.workout_date >= start && qualifies(w)).map((w) => w.workout_date)
  );
  const goal = effectiveGoal(profile);
  return { days: days.size, dates: days, goal, pct: days.size / goal };
}

// Træningsdage i en duel (pas logget i perioden).
export function duelDays(workouts, userId, from, to) {
  return new Set(
    workouts
      .filter((w) => w.user_id === userId && qualifies(w) && new Date(w.created_at) >= from && new Date(w.created_at) < to)
      .map((w) => w.workout_date)
  ).size;
}

export const pctText = (x) => `${Math.round(x * 100)}%`;

// Dansk ejefald: "Hannes", men "Mads'".
export const genitive = (name) => (/[sxz]$/i.test(name) ? `${name}'` : `${name}s`);

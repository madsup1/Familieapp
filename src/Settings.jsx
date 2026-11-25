import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from './supabase.js';

const FIELDS = [
  ['max_players', 'Maks. antal spillere', 1],
  ['xp_per_km_running', 'XP pr. km løb', 0.1],
  ['xp_per_km_walking', 'XP pr. km gåtur', 0.1],
  ['xp_per_km_cycling', 'XP pr. km cykling', 0.1],
  ['xp_per_minute_swimming', 'XP pr. minut svømning', 0.1],
  ['xp_per_minute_strength', 'XP pr. minut styrke', 0.1],
  ['xp_per_minute_other', 'XP pr. minut andet', 0.1],
  ['daily_xp_cap', 'Dagligt XP-loft', 1],
  ['level_curve_base', 'Niveaukurve: grundtal', 1],
  ['level_curve_exponent', 'Niveaukurve: eksponent', 0.1],
  ['stage2_level', 'Trin 2 fra niveau', 1],
  ['stage3_level', 'Trin 3 fra niveau', 1],
  ['stage4_level', 'Trin 4 fra niveau', 1],
  ['stage5_level', 'Trin 5 fra niveau', 1],
  ['duel_duration_days', 'Duel: antal dage', 1],
  ['max_active_duels', 'Duel: maks. aktive dueller pr. spiller', 1],
  ['history_days', 'Historik: dage tilbage der vises (billeder slettes derefter)', 1],
];

function Invitations({ profiles, settings, setError }) {
  const [emails, setEmails] = useState([]);
  const [email, setEmail] = useState('');

  async function load() {
    const { data, error } = await supabase.from('allowed_emails').select('email').order('created_at');
    if (error) setError(error.message);
    else setEmails(data.map((r) => r.email));
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(e) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    const { error } = await supabase.from('allowed_emails').insert({ email: clean });
    if (error) setError(error.code === '23505' ? 'Den e-mail er allerede inviteret.' : error.message);
    else { setEmail(''); load(); }
  }

  async function remove(addr) {
    const { error } = await supabase.from('allowed_emails').delete().eq('email', addr);
    if (error) setError(error.message);
    else load();
  }

  return (
    <div className="card stack">
      <h3 className="pixel label">Invitationer</h3>
      <p className="sub">
        Kun e-mails på listen kan oprette en konto. Ligaen har {profiles.length} af {settings.max_players} pladser i brug.
      </p>
      {emails.map((addr) => (
        <div key={addr} className="trip">
          <span>{addr}</span>
          <button className="iconbtn" onClick={() => remove(addr)} aria-label={`Fjern ${addr}`}><Trash2 size={18} /></button>
        </div>
      ))}
      <form onSubmit={add} className="invite-form">
        <input type="email" placeholder="mor@eksempel.dk" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button className="btn primary pixel">Inviter</button>
      </form>
      <p className="sub small">Send derefter linket til appen. De opretter sig med præcis den e-mail.</p>
    </div>
  );
}

export default function Settings({ profiles, settings, refresh, setError }) {
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS.map(([k]) => [k, String(settings[k])])));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    const update = Object.fromEntries(FIELDS.map(([k]) => [k, Number(String(values[k]).replace(',', '.'))]));
    if (Object.values(update).some((v) => !Number.isFinite(v) || v < 0)) {
      setBusy(false);
      return setError('Alle værdier skal være tal på 0 eller mere.');
    }
    const { error } = await supabase.from('settings').update(update).eq('id', 1);
    setBusy(false);
    if (error) setError(error.message);
    else { setSaved(true); refresh(); }
  }

  return (
    <section>
      <h1>Indstillinger</h1>
      <p className="lead">Inviter spillere og styr balancen. Ændringer slår igennem med det samme.</p>
      <Invitations profiles={profiles} settings={settings} setError={setError} />
      <form className="card stack" onSubmit={save}>
        <h3 className="pixel label">Balance</h3>
        {FIELDS.map(([key, label, step]) => (
          <label key={key} className="field">
            <span>{label}</span>
            <input
              type="number" step={step} min="0" inputMode="decimal" value={values[key]}
              onChange={(e) => { setSaved(false); setValues({ ...values, [key]: e.target.value }); }}
            />
          </label>
        ))}
        <button className="btn primary big pixel" disabled={busy}>{busy ? 'Gemmer…' : 'Gem indstillinger'}</button>
        {saved && <p className="notice">Indstillingerne er gemt.</p>}
      </form>
    </section>
  );
}

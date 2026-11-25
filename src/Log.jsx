import { useEffect, useState } from 'react';
import { Footprints, PersonStanding, Bike, Waves, Dumbbell, Activity, Camera, ImagePlus, X } from 'lucide-react';
import { PhotoThumb, shrinkImage } from './Photo.jsx';
import { supabase } from './supabase.js';
import Cheers from './Cheers.jsx';
import {
  TYPE_LABELS, TYPE_HINTS, localISO, shortDate, autoConfirmText, rawXp, isDistanceType, qualifies, MIN_MINUTES, MIN_KM,
} from './game.js';

export const TYPE_ICONS = {
  running: Footprints, walking: PersonStanding, cycling: Bike, swimming: Waves, strength: Dumbbell, other: Activity,
};
const ICONS = TYPE_ICONS;
const MUSCLES = ['Ben', 'Ryg', 'Bryst', 'Arme', 'Skuldre', 'Mave/core', 'Hele kroppen'];

export default function Log({ me, settings, workouts, cheers, profiles, refresh, setError, initialType = 'running' }) {
  const [type, setType] = useState(initialType);
  const [date, setDate] = useState(localISO());
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [muscle, setMuscle] = useState('');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    if (!photo) { setPhotoUrl(null); return undefined; }
    const u = URL.createObjectURL(photo);
    setPhotoUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  const mine = workouts.filter((w) => w.user_id === me.id);
  const usedOnDate = mine.filter((w) => w.workout_date === date).reduce((a, w) => a + Number(w.xp_awarded), 0);
  const todayXp = mine.filter((w) => w.workout_date === localISO()).reduce((a, w) => a + Number(w.xp_awarded), 0);
  const todayPending = mine
    .filter((w) => w.workout_date === localISO() && w.proof_status === 'pending')
    .reduce((a, w) => a + rawXp(w, settings), 0);
  const cap = settings.daily_xp_cap;

  const byDistance = isDistanceType(type);
  const draft = { type, distance_km: Number(distance) || 0, duration_minutes: Number(duration) || 0, proof_status: 'pending' };
  const raw = rawXp(draft, settings);
  const preview = Math.round(Math.max(0, Math.min(raw, cap - usedOnDate)));
  const countsAsDay = qualifies(draft);

  const valid =
    byDistance ? Number(distance) > 0
    : type === 'strength' ? Number(duration) > 0 && photo
    : Number(duration) > 0;

  async function save(e) {
    e.preventDefault();
    if (!valid) return;
    setError('');
    setMessage('');
    setBusy(true);
    const id = crypto.randomUUID();
    let proofPath = null;
    try {
      if (photo) {
        const file = await shrinkImage(photo);
        const ext = file.type === 'image/jpeg' ? 'jpg' : (photo.name.split('.').pop() || 'jpg').toLowerCase();
        proofPath = `${me.id}/${id}.${ext}`;
        const { error: upErr } = await supabase.storage.from('proofs').upload(proofPath, file, { contentType: file.type || 'image/jpeg' });
        if (upErr) throw upErr;
      }
      const { error } = await supabase.from('workouts').insert({
        id,
        user_id: me.id,
        type,
        workout_date: date,
        duration_minutes: Number(duration) > 0 ? Number(duration) : null,
        distance_km: byDistance ? Number(distance) : null,
        muscle_group: type === 'strength' && muscle ? muscle : null,
        proof_path: proofPath,
        proof_status: 'pending',
      });
      if (error) {
        if (proofPath) await supabase.storage.from('proofs').remove([proofPath]);
        throw error;
      }
      setMessage(`Gemt! Dine ${preview} XP tæller, når en anden har bekræftet turen – eller automatisk efter 3 dage. Din figur er allerede i topform igen.`);
      setDuration('');
      setDistance('');
      setMuscle('');
      setPhoto(null);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Log træning</h1>
      <p className="lead">Vælg type, skriv hvor meget — vi regner XP ud.</p>

      <form className="card stack" onSubmit={save}>
        <span className="flabel">Vælg type</span>
        <div className="typegrid">
          {Object.keys(TYPE_LABELS).map((t) => {
            const Icon = ICONS[t];
            return (
              <button type="button" key={t} className={`typecard ${type === t ? 'active' : ''}`} onClick={() => { setType(t); setPhoto(null); }}>
                <Icon size={30} />
                <strong>{TYPE_LABELS[t]}</strong>
                <span>{TYPE_HINTS[t]}</span>
              </button>
            );
          })}
        </div>

        <div className="field">
          <span>Dato</span>
          <div className="chips date-chips">
            {[['I dag', 0], ['I går', 1]].map(([label, back]) => {
              const d = new Date();
              d.setDate(d.getDate() - back);
              const iso = localISO(d);
              return (
                <button key={label} type="button" className={`chip ${date === iso ? 'active' : ''}`} aria-pressed={date === iso} onClick={() => setDate(iso)}>{label}</button>
              );
            })}
          </div>
          <input type="date" aria-label="Vælg en anden dato" value={date} max={localISO()} onChange={(e) => setDate(e.target.value)} required />
        </div>

        {byDistance && (
          <label className="field">
            <span>Distance (km)</span>
            <input type="number" min="0" step="0.1" inputMode="decimal" placeholder="5,0" value={distance} onChange={(e) => setDistance(e.target.value)} />
          </label>
        )}

        <label className="field">
          <span>Varighed (minutter){byDistance ? ' — valgfri' : ''}</span>
          <input type="number" min="1" inputMode="numeric" placeholder={byDistance ? '32' : '45'} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </label>

        {type === 'strength' && (
          <>
            <span className="flabel">Muskelgruppe — valgfri</span>
            <div className="chips">
              {MUSCLES.map((m) => (
                <button type="button" key={m} className={`chip ${muscle === m ? 'active' : ''}`} onClick={() => setMuscle(muscle === m ? '' : m)}>
                  {m}
                </button>
              ))}
            </div>
            {photoUrl ? (
              <div className="photo-chosen">
                <img src={photoUrl} alt="Valgt bevisbillede" />
                <button type="button" className="iconbtn" onClick={() => setPhoto(null)} aria-label="Fjern billede"><X size={18} /></button>
              </div>
            ) : (
              <label className="photo">
                <Camera size={24} />
                <span>Tag et billede som bevis<small>Påkrævet for styrketræning</small></span>
                <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </>
        )}

        {type !== 'strength' && (
          photoUrl ? (
            <div className="photo-chosen">
              <img src={photoUrl} alt="Valgt billede" />
              <button type="button" className="iconbtn" onClick={() => setPhoto(null)} aria-label="Fjern billede"><X size={18} /></button>
            </div>
          ) : (
            <label className="photo">
              <ImagePlus size={24} />
              <span>
                Vedhæft billede — valgfrit
                <small>{byDistance ? 'Fx et skærmbillede af turen fra Strava' : 'Fx et billede fra turen'}</small>
              </span>
              <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </label>
          )
        )}

        <div className="gain">
          <span>Du får</span>
          <span className="pixel blue-text gainxp">
            {preview} XP{preview > 0 ? <small> når turen er bekræftet</small> : null}
          </span>
        </div>
        {raw > 0 && preview < raw && <p className="sub small">Dagens loft på {cap} XP begrænser denne tur.</p>}
        {raw > 0 && (
          <p className={`sub small daynote ${countsAsDay ? 'ok' : ''}`}>
            {countsAsDay
              ? 'Tæller som træningsdag i dit ugemål.'
              : `Tæller ikke som træningsdag endnu: mindst ${MIN_MINUTES} minutter eller ${MIN_KM} km.`}
          </p>
        )}

        <button className="btn primary big pixel" disabled={busy || !valid}>
          {busy ? 'Gemmer…' : 'Gem træning'}
        </button>
        {message && <p className="notice">{message}</p>}
      </form>

      <div className="card">
        <div className="spread">
          <h3 className="pixel label">I dag</h3>
          <strong>{Math.round(todayXp)}/{cap} XP</strong>
        </div>
        <div className="progress green stacked">
          <div style={{ width: `${Math.min(100, (todayXp / cap) * 100)}%` }} />
          <div className="pending-fill" style={{ width: `${Math.min(100 - Math.min(100, (todayXp / cap) * 100), (todayPending / cap) * 100)}%` }} />
        </div>
        {todayPending > 0 && <p className="sub small">+{Math.round(todayPending)} XP afventer bekræftelse.</p>}
      </div>

      <div className="card">
        <h3 className="pixel label">Seneste ture</h3>
        <p className="sub small">Viser de seneste {Math.round((settings.history_days || 60) / 30)} måneder. Din XP tæller for altid, men billeder slettes efter den tid.</p>
        {mine.length === 0 && <p className="sub">Ingen ture endnu. Første skridt er det vigtigste!</p>}
        {mine.slice(0, 10).map((w) => (
          <div key={w.id} className="feed-item">
          <div className="trip">
            <div>
              <strong>{TYPE_LABELS[w.type]}</strong>
              <div className="sub small">
                {shortDate(w.workout_date)}
                {w.distance_km ? ` · ${Number(w.distance_km).toLocaleString("da-DK")} km` : ''}
                {w.duration_minutes ? ` · ${Number(w.duration_minutes)} min` : ''}
                {w.muscle_group ? ` · ${w.muscle_group}` : ''}
              </div>
              {w.proof_status === 'pending' && <span className="tag">Afventer bekræftelse · {autoConfirmText(w)}</span>}
              {w.proof_status === 'rejected' && <span className="tag red">Afvist</span>}
            </div>
            <div className="trip-right">
              <span className={`pixel ${w.proof_status === 'pending' ? 'muted' : 'blue-text'}`}>
                +{Math.round(w.proof_status === 'pending' ? rawXp(w, settings) : w.xp_awarded)}
              </span>
              {w.proof_path && <PhotoThumb path={w.proof_path} />}
            </div>
          </div>
          <Cheers workout={w} me={me} cheers={cheers || []} profiles={profiles} refresh={refresh} setError={setError} />
          </div>
        ))}
      </div>
    </section>
  );
}

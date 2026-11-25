import { useEffect, useState } from 'react';
import { Lock, Bell, BellOff, Send } from 'lucide-react';
import { supabase } from './supabase.js';
import Figure from './Figure.jsx';
import {
  SLOTS, SLOT_LABELS, STAGE_NAMES, FORM, formLevel, isUnlocked, unlockText, playerInfo, xpForLevel, firstName,
  genitive, LOOK, lookOf,
} from './game.js';
import {
  pushSupported, isIOS, isStandalone, currentSubscription, enablePush, disablePush, sendTest, sampleMessage,
} from './notify.js';

const PREVIEW = import.meta.env.VITE_PREVIEW === '1';

function NameCard({ me, character, refresh, setError }) {
  const [name, setName] = useState(character?.name ?? '');
  const [saved, setSaved] = useState(false);
  const unchanged = (character?.name ?? '') === name.trim();

  async function save(e) {
    e.preventDefault();
    const clean = name.trim().slice(0, 24);
    const { error } = await supabase.from('characters').update({ name: clean || null }).eq('user_id', me.id);
    if (error) return setError(error.message);
    setSaved(true);
    refresh();
  }

  return (
    <form className="namecard" onSubmit={save}>
      <label className="field">
        <span>Figurens navn</span>
        <input
          value={name}
          maxLength={24}
          placeholder="Fx Bobby, Turbo eller Lille Mads"
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
        />
      </label>
      <button className="btn primary pixel" disabled={unchanged}>Gem navn</button>
      {saved && <span className="sub small">Gemt!</span>}
    </form>
  );
}

const LOOK_ROWS = [
  ['hair', 'Hårfarve'], ['skin', 'Hudfarve'], ['shirt', 'T-shirt'], ['pants', 'Bukser'],
];

function LookCard({ appearance, onChange }) {
  const gender = lookOf(appearance, 'gender').id;
  return (
    <div className="card">
      <h3 className="pixel label">Udseende</h3>
      <div className="slot look-slot">
        <span className="flabel">Figur</span>
        <div className="chips look-gender">
          {LOOK.gender.map((g) => (
            <button key={g.id} className={`chip ${gender === g.id ? 'active' : ''}`} aria-pressed={gender === g.id}
              onClick={() => onChange({ gender: g.id })}>{g.name}</button>
          ))}
        </div>
      </div>
      {LOOK_ROWS.map(([key, label]) => {
        const current = lookOf(appearance, key).id;
        const shirtHidden = key === 'shirt' && appearance.top;
        return (
          <div key={key} className="slot look-slot">
            <span className="flabel">{label}: <b className="look-current">{shirtHidden ? 'trøje fra Udstyr' : lookOf(appearance, key).name}</b></span>
            <div className="dotrow">
              {LOOK[key].map((o) => {
                const on = current === o.id && !shirtHidden;
                return (
                  <button key={o.id} className={`dot ${on ? 'active' : ''}`} aria-pressed={on} aria-label={`${label}: ${o.name}`} title={o.name}
                    style={{ background: o.color }}
                    onClick={() => onChange(key === 'shirt' ? { shirt: o.id, top: null } : { [key]: o.id })} />
                );
              })}
            </div>
            {shirtHidden && <p className="sub small">Tryk på en farve for at skifte til t-shirt.</p>}
          </div>
        );
      })}
    </div>
  );
}

function FormCard({ figName, form }) {
  return (
    <div className={`formcard level-${form.level}`}>
      <div className="formsteps">
        {FORM.map((f, i) => <span key={f.label} className={i <= form.level ? 'on' : ''} />)}
      </div>
      <div>
        <strong>{form.label}</strong>
        <span className="sub small">
          {form.days === 0
            ? `${figName} har trænet i dag.`
            : `${form.days} ${form.days === 1 ? 'dag' : 'dage'} siden sidste træning. ${form.text}`}
          {form.level > 0 && ' Én træning, så er formen tilbage med det samme.'}
        </span>
      </div>
    </div>
  );
}

function NotifyCard({ me, figName, form }) {
  const [status, setStatus] = useState('checking');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [example, setExample] = useState(null);

  useEffect(() => {
    if (PREVIEW || !pushSupported()) { setStatus('unsupported'); return; }
    if (isIOS() && !isStandalone()) { setStatus('install'); return; }
    currentSubscription().then((s) => setStatus(s ? 'on' : 'off')).catch(() => setStatus('off'));
  }, []);

  async function run(fn, ok) {
    setBusy(true);
    setMsg('');
    try { await fn(); ok?.(); } catch (e) { setMsg(e.message || String(e)); } finally { setBusy(false); }
  }

  const showExample = () => {
    const lvl = form.level || 2;
    setExample({ title: figName, body: sampleMessage(me.name, figName, lvl, Math.max(form.days, lvl === 1 ? 2 : lvl === 2 ? 5 : 8)) });
  };

  if (status === 'on' || status === 'checking') {
    return (
      <div className="card stack compact-notify">
        <div className="spread">
          <h3 className="pixel label"><Bell size={16} /> Beskeder er slået til</h3>
        </div>
        <div className="row">
          <button className="btn" disabled={busy || status === 'checking'} onClick={() => run(async () => { const n = await sendTest(); setMsg(n ? 'Prøvebesked sendt!' : 'Ingen enhed modtog beskeden.'); })}>
            <Send size={18} /> Send en prøve
          </button>
          <button className="linkbtn top0" disabled={busy || status === 'checking'} onClick={() => run(disablePush, () => setStatus('off'))}>Slå fra</button>
        </div>
        {msg && <p className="notice">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="card stack">
      <h3 className="pixel label">Beskeder fra {figName}</h3>
      <p className="sub">
        {figName} siger til, når I ikke har trænet i et par dage, når nogen udfordrer dig til duel, eller når et styrkepas venter på din bekræftelse.
        Højst én besked om dagen, ved 17:30-tiden.
      </p>

      {status === 'install' && (
        <div className="notice warn">
          På iPhone skal appen ligge på hjemmeskærmen først: tryk på Del-knappen i Safari, vælg <strong>Føj til hjemmeskærm</strong>, og åbn appen derfra. Så kan du slå beskeder til her.
        </div>
      )}
      {status === 'unsupported' && (
        <div className="notice warn">
          {PREVIEW ? 'Beskeder kan ikke slås til i previewen, men du kan se et eksempel herunder.' : 'Denne browser kan ikke modtage beskeder.'}
        </div>
      )}
      {status === 'off' && (
        <button className="btn primary big pixel" disabled={busy} onClick={() => run(() => enablePush(me.id), () => setStatus('on'))}>
          <Bell size={20} /> Slå beskeder til
        </button>
      )}
      {status === 'on' && (
        <div className="row">
          <button className="btn primary pixel" disabled={busy} onClick={() => run(async () => { const n = await sendTest(); setMsg(n ? 'Prøvebesked sendt!' : 'Ingen enhed modtog beskeden.'); })}>
            <Send size={18} /> Send en prøve
          </button>
          <button className="btn" disabled={busy} onClick={() => run(disablePush, () => setStatus('off'))}>
            <BellOff size={18} /> Slå fra
          </button>
        </div>
      )}
      <button className="linkbtn left" onClick={showExample}>Se et eksempel på en besked</button>
      {example && (
        <div className="fake-push" role="status">
          <div className="fake-push-head"><span className="fake-icon" /> <b>MOTIONSLIGAEN</b><span>nu</span></div>
          <strong>{example.title}</strong>
          <p>{example.body}</p>
        </div>
      )}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}

export default function Character({ me, settings, items, workouts, characters, playerStats, appearanceOf, refresh, setError }) {
  const p = playerInfo(me, workouts, settings, playerStats);
  const character = characters.find((c) => c.user_id === me.id);
  const figName = character?.name || 'Din figur';
  const [appearance, setAppearance] = useState(appearanceOf(me.id));
  const [simDays, setSimDays] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const form = simDays === null ? p.form : { days: simDays, level: formLevel(simDays), ...FORM[formLevel(simDays)] };

  const lower = xpForLevel(p.level, settings);
  const next = xpForLevel(p.level + 1, settings);
  const pct = Math.min(100, ((p.stats.total - lower) / Math.max(1, next - lower)) * 100);

  async function choose(slot, itemId) {
    return save({ [slot]: itemId });
  }

  async function save(changes) {
    const nextApp = { ...appearance };
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) delete nextApp[k];
      else nextApp[k] = v;
    }
    setAppearance(nextApp);
    const { error } = await supabase.from('characters').update({ appearance: nextApp }).eq('user_id', me.id);
    if (error) setError(error.message);
    else refresh();
  }

  return (
    <section>
      <h1>{character?.name ? character.name : 'Min figur'}</h1>
      <p className="lead">{character?.name ? `${genitive(firstName(me.name))} træningsmakker.` : 'Giv din figur et navn, og vælg det udstyr du har låst op.'}</p>

      <div className="card hero">
        <div className="hero-figure">
          <Figure interactive appearance={appearance} items={items} stats={p.stats} decay={form.level} size={260} />
        </div>
        <div className="hero-stats">
          <NameCard key={character?.name ?? ''} me={me} character={character} refresh={refresh} setError={setError} />
          <h3 className="pixel label">{STAGE_NAMES[p.stage - 1]} · Trin {p.stage}</h3>
          <div className="bigxp">{Math.round(p.stats.total)} XP</div>
          <div className="sub">Niveau {p.level}</div>
          <div className="spread small-gap">
            <strong>Næste niveau</strong>
            <span className="sub">{Math.round(p.stats.total)}/{next} XP</span>
          </div>
          <div className="progress blue"><div style={{ width: `${pct}%` }} /></div>
          <div className="statgrid">
            <div className="stat"><span className="green-text">Udholdenhed</span><b className="pixel">{Math.round(p.stats.stamina)}</b></div>
            <div className="stat"><span className="orange-text">Styrke</span><b className="pixel">{Math.round(p.stats.strength)}</b></div>
          </div>
          <FormCard figName={figName} form={form} />
          {PREVIEW && (
            <label className="field sim">
              <span>Preview: dage uden træning ({simDays ?? p.form.days})</span>
              <input type="range" min="0" max="10" value={simDays ?? p.form.days} onChange={(e) => setSimDays(Number(e.target.value))} />
            </label>
          )}
        </div>
      </div>

      <LookCard appearance={appearance} onChange={save} />

      <NotifyCard me={me} figName={figName} form={form} />

      <div className="card">
        <div className="spread">
          <h3 className="pixel label">Udstyr</h3>
          <button className="linkbtn top0" onClick={() => setShowAll(!showAll)}>{showAll ? 'Vis mindre' : 'Vis alt'}</button>
        </div>
        <p className="sub small">{showAll ? 'Alt udstyr, også det du ikke har låst op endnu.' : 'Dit udstyr og det næste du kan låse op.'}</p>
        {SLOTS.map((slot) => {
          const all = items
            .filter((i) => i.slot === slot)
            .sort((a, b) => Number(a.stage_required) - Number(b.stage_required) || Number(a.unlock_value) - Number(b.unlock_value));
          if (!all.length) return null;
          const nextLocked = all.find((i) => !isUnlocked(i, p.stats, p.level, p.stage));
          const options = showAll ? all : all.filter((i) => isUnlocked(i, p.stats, p.level, p.stage) || i === nextLocked);
          const optional = !['background', 'body'].includes(slot);
          return (
            <div key={slot} className="slot">
              <span className="flabel">{SLOT_LABELS[slot]}</span>
              <div className="itemgrid">
                {options.map((item) => {
                  const unlocked = isUnlocked(item, p.stats, p.level, p.stage);
                  const selected = appearance[slot] === item.id;
                  return (
                    <button
                      key={item.id}
                      disabled={!unlocked}
                      className={`itemcard ${selected ? 'active' : ''} ${unlocked ? '' : 'locked'}`}
                      onClick={() => choose(slot, selected && optional ? null : item.id)}
                    >
                      <span className="swatch" style={{ background: unlocked ? item.color : undefined }} />
                      <span className="itemtext">
                        <strong>{item.name}</strong>
                        {selected ? <span>Valgt</span> : unlocked ? <span>{optional ? 'Tryk for at vælge' : 'Låst op'}</span> : (
                          <span className="lockline"><Lock size={14} /> {unlockText(item)}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

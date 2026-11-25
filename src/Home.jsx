import { useEffect, useState } from 'react';
import { Hand, Target, ChevronDown } from 'lucide-react';
import { PhotoThumb } from './Photo.jsx';
import { supabase } from './supabase.js';
import Figure from './Figure.jsx';
import Cheers, { CommentChips, giveCheer } from './Cheers.jsx';
import { TYPE_ICONS } from './Log.jsx';
import {
  playerInfo, sumXp, startOfWeek, localISO, daysLeft, firstName, shortDate,
  TYPE_LABELS, STAGE_NAMES, autoConfirmText, rawXp,
  weekProgress, duelDays, pctText, MIN_MINUTES, MIN_KM,
  genitive,
} from './game.js';

const DAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
// Testet for farveblindhed (alle par kan skelnes). Farven følger spilleren (tilmeldingsrækkefølge), ikke placeringen.
export const PLAYER_COLORS = ['#0B4FC2', '#E66100', '#0E9F6E', '#B0307A', '#5BB8EE'];

const workoutLine = (w) =>
  `${shortDate(w.workout_date)}${w.distance_km ? ` · ${Number(w.distance_km).toLocaleString('da-DK')} km` : ''}` +
  `${w.duration_minutes ? ` · ${Number(w.duration_minutes)} min` : ''}${w.muscle_group ? ` · ${w.muscle_group}` : ''}`;

// Hvornår bevisbilledet er taget, så den der bekræfter kan se det
function PhotoDateTag({ w }) {
  if (!w.proof_path) return null;
  if (!w.photo_taken_at) return <span className="tag photo-unknown">📷 Dato ukendt</span>;
  const [day, time] = String(w.photo_taken_at).split('T');
  const hm = (time || '').slice(0, 5);
  if (day !== w.workout_date) return <span className="tag photo-bad">📷 Taget {shortDate(day)} – ikke samme dag!</span>;
  return <span className="tag photo-ok">📷 Samme dag{hm ? ` kl. ${hm}` : ''}</span>;
}

// ---------- Dit ugemål ----------
function GoalCard({ me, workouts, refresh, setError }) {
  const prog = weekProgress(workouts, me);
  const intro = !me.goal_set;
  const [editing, setEditing] = useState(intro);
  const [value, setValue] = useState(me.pending_goal || prog.goal);
  const [busy, setBusy] = useState(false);
  const start = startOfWeek();
  const today = localISO();

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc('set_weekly_goal', { p_goal: value });
    setBusy(false);
    if (error) return setError(error.message);
    setEditing(false);
    refresh();
  }

  const done = prog.days >= prog.goal;
  return (
    <div className={`card goalcard ${done ? 'done' : ''}`}>
      <div className="spread">
        <h3 className="pixel label">{intro ? 'Sæt dit ugemål' : 'Dit ugemål'}</h3>
        {!intro && <button className="linkbtn" onClick={() => setEditing(!editing)}>{editing ? 'Luk' : 'Skift mål'}</button>}
      </div>
      {intro && (
        <p className="sub goal-introtext">
          <Target size={18} /> Hvor mange dage om ugen vil du træne? Stillingen og duellerne måles i procent af hver persons eget mål.
        </p>
      )}
      <div className="goal-main">
        <span className="goal-num pixel">{prog.days}/{prog.goal}</span>
        <span className="sub">
          {done
            ? prog.days > prog.goal ? `Målet er nået, og du er over! ${pctText(prog.pct)}` : 'Målet er nået. Sådan!'
            : `træningsdage denne uge. ${prog.goal - prog.days} ${prog.goal - prog.days === 1 ? 'dag' : 'dage'} igen.`}
        </span>
      </div>
      <div className="weekdots">
        {DAYS.map((label, i) => {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const iso = localISO(d);
          return (
            <span key={label} className={`weekdot ${prog.dates.has(iso) ? 'on' : ''} ${iso === today ? 'today' : ''}`}>
              {label.charAt(0)}
            </span>
          );
        })}
      </div>
      {me.pending_goal && me.pending_from > today && (
        <p className="sub small">Fra mandag {shortDate(me.pending_from)}: {me.pending_goal} dage om ugen.</p>
      )}
      {editing && (
        <div className="goal-edit">
          <span className="flabel">Træningsdage om ugen</span>
          <div className="goal-options">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button key={n} type="button" className={`chip ${value === n ? 'active' : ''}`} onClick={() => setValue(n)}>{n}</button>
            ))}
          </div>
          <p className="sub small">
            {me.goal_set ? 'Et nyt mål gælder fra næste mandag, så ingen kan ændre det midt i ugen.' : 'Dit første mål gælder med det samme.'}
            {` En dag tæller, når du har trænet mindst ${MIN_MINUTES} minutter eller ${MIN_KM} km.`}
          </p>
          <button className="btn primary pixel" disabled={busy} onClick={save}>Gem mål</button>
        </div>
      )}
    </div>
  );
}

// ---------- Dueller (målt i procent af eget mål) ----------
function duelScore(d, workouts, userId) {
  const from = new Date(d.start_at);
  const to = new Date(d.end_at);
  const weeks = (to - from) / (7 * 86400000);
  const goal = (userId === d.challenger_id ? d.challenger_goal : d.opponent_goal) || 3;
  const days = duelDays(workouts, userId, from, to);
  const target = Math.max(1, Math.round(goal * weeks));
  return { days, target, pct: days / Math.max(goal * weeks, 1), xp: sumXp(workouts, userId, { from, to }).total };
}

function DuelCard({ me, players, items, workouts, duels, appearanceOf, figNameOf, refresh, setError }) {
  const others = players.filter((p) => p.id !== me.id);
  const nameOf = (id) => firstName(players.find((p) => p.id === id)?.name ?? 'Ukendt');
  const involves = (d, id) => d.challenger_id === id || d.opponent_id === id;

  const activeAll = duels.filter((d) => d.status === 'active');
  const myActive = activeAll.find((d) => involves(d, me.id));
  const incoming = duels.filter((d) => d.status === 'pending' && d.opponent_id === me.id);
  const outgoing = duels.filter((d) => d.status === 'pending' && d.challenger_id === me.id);
  const otherActive = activeAll.filter((d) => !involves(d, me.id));
  const busy = new Set(activeAll.flatMap((d) => [d.challenger_id, d.opponent_id]));
  const lastMine = duels.find((d) => d.status === 'finished' && involves(d, me.id));
  const [picking, setPicking] = useState(false);

  const expiredId = myActive && new Date(myActive.end_at) <= new Date() ? myActive.id : null;
  useEffect(() => {
    if (!expiredId) return;
    supabase.rpc('settle_duel', { p_id: expiredId }).then(({ error }) => (error ? setError(error.message) : refresh()));
  }, [expiredId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function call(fn, args) {
    const { error } = await supabase.rpc(fn, args);
    if (error) setError(error.message);
    else refresh();
  }

  if (!others.length) {
    return (
      <div className="card">
        <h3 className="pixel label">Duel status</h3>
        <p className="sub">Der er kun dig i ligaen endnu. Inviter dine medspillere under Indstillinger, og bed dem oprette en konto — så dukker deres figurer op her.</p>
      </div>
    );
  }

  let versus = null;
  if (myActive) {
    const oppId = myActive.challenger_id === me.id ? myActive.opponent_id : myActive.challenger_id;
    const opp = players.find((p) => p.id === oppId);
    const mineS = duelScore(myActive, workouts, me.id);
    const oppS = duelScore(myActive, workouts, oppId);
    const max = Math.max(mineS.pct, oppS.pct, 1);
    const left = daysLeft(myActive.end_at);
    versus = (
      <>
        <div className="versus">
          {[[players.find((p) => p.id === me.id), mineS, 'blue', 15], [opp, oppS, 'orange', -15]].map(([p, sc, col, ang]) => (
            <div key={p.id} className="vs-player">
              <Figure appearance={appearanceOf(p.id)} items={items} stats={p.stats} decay={p.decay} size={120} angle={ang} />
              <strong>{figNameOf(p.id) ?? firstName(p.name)}</strong>
              {figNameOf(p.id) && <span className="muted small">{genitive(firstName(p.name))} figur</span>}
              <span className={`pixel xp ${col}`}>{pctText(sc.pct)}</span>
              <span className="muted small">{sc.days} af {sc.target} dage · {Math.round(sc.xp)} XP</span>
            </div>
          ))}
          <span className="vs pixel">VS</span>
        </div>
        <div className="duelbar">
          <div className="fill blue" style={{ width: `${(mineS.pct / max) * 50}%` }} />
          <div className="fill orange" style={{ width: `${(oppS.pct / max) * 50}%` }} />
        </div>
        <p className="sub">
          {new Date(myActive.end_at) <= new Date()
            ? 'Duellen er slut. Vinderen findes, når alle pas fra perioden er bekræftet.'
            : `${left} ${left === 1 ? 'dag' : 'dage'} tilbage. Højest procent af eget ugemål vinder; står det lige, afgør XP.`}
        </p>
      </>
    );
  }

  return (
    <div className="card">
      <h3 className="pixel label">Duel</h3>
      {versus}

      {incoming.map((d) => (
        <div key={d.id} className="duel-line">
          <p className="sub"><strong>{nameOf(d.challenger_id)}</strong> udfordrer dig til en duel!</p>
          <div className="row">
            <button className="btn primary pixel" disabled={!!myActive} onClick={() => call('accept_duel', { p_id: d.id })}>Accepter</button>
            <button className="btn" onClick={() => call('decline_duel', { p_id: d.id })}>Afvis</button>
          </div>
        </div>
      ))}

      {outgoing.map((d) => (
        <div key={d.id} className="duel-line spread">
          <p className="sub">Venter på svar fra {nameOf(d.opponent_id)}.</p>
          <button className="btn" onClick={() => call('decline_duel', { p_id: d.id })}>Træk tilbage</button>
        </div>
      ))}

      {!myActive && (
        <>
          {lastMine && (
            <p className="sub">
              Din sidste duel mod {nameOf(lastMine.challenger_id === me.id ? lastMine.opponent_id : lastMine.challenger_id)}:{' '}
              {lastMine.winner_id ? (lastMine.winner_id === me.id ? 'du vandt' : 'du tabte') : 'uafgjort'}.
            </p>
          )}
          {!picking && (
            <button className="btn pixel wide" onClick={() => setPicking(true)}>Udfordr en medspiller</button>
          )}
          {picking && (<>
          <div className="spread">
            <span className="flabel">Udfordr en medspiller</span>
            <button className="linkbtn top0" onClick={() => setPicking(false)}>Luk</button>
          </div>
          <p className="sub small">I dyster i 7 dage om at nå flest procent af jeres eget ugemål.</p>
          <div className="challenge-grid">
            {others.map((p) => {
              const challengedMe = incoming.some((d) => d.challenger_id === p.id);
              const pending = challengedMe || outgoing.some((d) => d.opponent_id === p.id);
              const isBusy = busy.has(p.id);
              return (
                <button key={p.id} className="challenge" disabled={isBusy || pending} onClick={() => call('challenge_player', { p_opponent: p.id })}>
                  <Figure appearance={appearanceOf(p.id)} items={items} stats={p.stats} decay={p.decay} size={64} />
                  <span>
                    <strong>{firstName(p.name)}</strong>
                    <small>{isBusy ? 'I en duel' : challengedMe ? 'Har udfordret dig' : pending ? 'Udfordring sendt' : 'Tryk for at udfordre'}</small>
                  </span>
                </button>
              );
            })}
          </div>
          </>)}
        </>
      )}

      {otherActive.length > 0 && (
        <div className="league-duels">
          <span className="flabel">Andre dueller</span>
          {otherActive.map((d) => {
            const a = duelScore(d, workouts, d.challenger_id);
            const b = duelScore(d, workouts, d.opponent_id);
            return (
              <div key={d.id} className="trip">
                <span><strong>{nameOf(d.challenger_id)}</strong> mod <strong>{nameOf(d.opponent_id)}</strong></span>
                <span className="pixel">{pctText(a.pct)}–{pctText(b.pct)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Stilling: procent af eget ugemål ----------
function Standings({ me, players, items, workouts, appearanceOf, figNameOf }) {
  const from = startOfWeek();
  const rows = players
    .map((p) => ({ ...p, prog: weekProgress(workouts, p), week: sumXp(workouts, p.id, { from }).total }))
    .sort((a, b) => b.prog.pct - a.prog.pct || b.week - a.week);
  return (
    <div className="card">
      <h3 className="pixel label">Stilling denne uge</h3>
      {rows.map((p, i) => (
        <div key={p.id} className={`standing ${p.id === me.id ? 'me' : ''}`}>
          <span className="rank pixel">{i + 1}</span>
          <Figure appearance={appearanceOf(p.id)} items={items} stats={p.stats} decay={p.decay} size={52} />
          <span className="standing-name">
            <strong>{firstName(p.name)}{p.id === me.id ? ' (dig)' : ''}</strong>
            <small>{p.prog.days} af {p.prog.goal} dage · {Math.round(p.week)} XP{figNameOf(p.id) ? ` · ${figNameOf(p.id)}` : ''}</small>
            <span className="minibar"><span style={{ width: `${Math.min(100, p.prog.pct * 100)}%` }} /></span>
            {p.form.level > 0 && <small className={`formtag level-${p.form.level}`}>{p.form.label} · {p.form.days} dage uden træning</small>}
          </span>
          <span className={`pixel ${p.prog.pct >= 1 ? 'green-text' : 'blue-text'}`}>{pctText(p.prog.pct)}</span>
        </div>
      ))}
    </div>
  );
}

// players kommer i tilmeldingsrækkefølge (profiles hentes sorteret på created_at), så farven følger personen
function WeekChart({ players, workouts }) {
  const start = startOfWeek();
  const days = DAYS.map((label, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = localISO(d);
    return {
      label,
      values: players.map((p) => workouts.filter((w) => w.user_id === p.id && w.workout_date === iso).reduce((a, w) => a + Number(w.xp_awarded), 0)),
    };
  });
  const peak = Math.max(40, ...days.flatMap((d) => d.values));
  const top = Math.ceil(peak / 40) * 40;
  const ticks = [4, 3, 2, 1, 0].map((i) => (top / 4) * i);

  return (
    <div className="card">
      <h3 className="pixel label">Denne uges aktivitet</h3>
      <p className="sub small">Bekræftet XP pr. dag</p>
      <div className="chart">
        <div className="yaxis">{ticks.map((t) => <span key={t}>{Math.round(t)}</span>)}</div>
        <div className="plot">
          <div className="gridlines">
            {ticks.map((t) => <div key={t} className="gridline" style={{ bottom: `${(t / top) * 100}%` }} />)}
          </div>
          {days.map((d) => (
            <div key={d.label} className="daycol">
              <div className="bars">
                {d.values.map((v, i) => (
                  <div
                    key={players[i].id}
                    className="bar"
                    style={{ height: `${(v / top) * 100}%`, background: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
                    title={`${firstName(players[i].name)}: ${Math.round(v)} XP`}
                  />
                ))}
              </div>
              <span className="daylabel">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="legend">
        {players.map((p, i) => (
          <span key={p.id}>
            <i className="sw" style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} /> {firstName(p.name)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Feed med high-fives ----------
const FEED_STEP = 5;
function Feed({ players, workouts, me, settings, cheers, refresh, setError }) {
  const [shown, setShown] = useState(FEED_STEP);
  const nameOf = (id) => firstName(players.find((p) => p.id === id)?.name ?? 'Ukendt');
  // Andres afventende pas står allerede under "Venter på bekræftelse"
  // Afviste pas vises kun for ejeren selv
  const all = workouts.filter((w) => (w.proof_status !== 'rejected' || w.user_id === me.id) && !(w.proof_status === 'pending' && w.user_id !== me.id));
  const items = all.slice(0, shown);
  if (!items.length) return null;
  return (
    <div className="card">
      <h3 className="pixel label">Seneste fra ligaen</h3>
      {items.map((w) => (
        <div key={w.id} className="feed-item">
          <div className="trip">
            <div>
              <strong>{w.user_id === me.id ? 'Dig' : nameOf(w.user_id)} · {TYPE_LABELS[w.type]}</strong>
              <div className="sub small">{workoutLine(w)}</div>
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
          <Cheers workout={w} me={me} cheers={cheers} profiles={players} refresh={refresh} setError={setError} />
        </div>
      ))}
      {all.length > shown && (
        <button className="btn morebtn" onClick={() => setShown(shown + FEED_STEP * 2)}>Vis flere</button>
      )}
    </div>
  );
}

// ---------- Bekræft med high-five ----------
function ConfirmItem({ w, me, nameOf, settings, refresh, setError }) {
  const [highfive, setHighfive] = useState(true);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const Icon = TYPE_ICONS[w.type];

  async function decide(decision) {
    setBusy(true);
    const { error } = await supabase.rpc('confirm_workout', { p_id: w.id, p_decision: decision });
    if (!error && decision === 'confirmed' && (highfive || comment.trim())) {
      const res = await giveCheer(w.id, me.id, comment);
      if (res.error) setError(res.error.message);
    }
    setBusy(false);
    if (error) setError(error.message);
    else refresh();
  }

  return (
    <div className="confirm-item">
      <button className="confirm-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="qicon small">{Icon && <Icon size={20} />}</span>
        <span className="confirm-text">
          <strong>{nameOf(w.user_id)} · {TYPE_LABELS[w.type]} · {Math.round(rawXp(w, settings))} XP</strong>
          <span className="sub small">{workoutLine(w)}</span>
          <PhotoDateTag w={w} />
        </span>
        <ChevronDown size={22} className={`chev ${open ? 'up' : ''}`} />
      </button>
      {open && (
        <div className="confirm-more">
          {w.proof_path && <PhotoThumb path={w.proof_path} large />}
          <CommentChips value={comment} onPick={setComment} />
          <input className="comment-input" value={comment} maxLength={140} placeholder="Skriv en kommentar (valgfrit)" onChange={(e) => setComment(e.target.value)} />
        </div>
      )}
      <label className="hf-toggle">
        <input type="checkbox" checked={highfive} onChange={(e) => setHighfive(e.target.checked)} />
        <Hand size={18} /> Giv {nameOf(w.user_id)} en high-five
      </label>
      <div className="confirm-actions">
        <button className="btn primary pixel" disabled={busy} onClick={() => decide('confirmed')}>Bekræft</button>
        {!open && <button className="linkbtn" onClick={() => setOpen(true)}>{w.proof_path ? 'Se billede' : 'Kommentér'}</button>}
        <button className="linkbtn muted-link" disabled={busy} onClick={() => decide('rejected')}>Afvis</button>
      </div>
      <p className="sub small">Ellers {autoConfirmText(w)}.</p>
    </div>
  );
}

export default function Home(rawProps) {
  const { me, profiles, settings, workouts, characters, playerStats, goLog, refresh, setError } = rawProps;
  const figNameOf = (id) => characters.find((c) => c.user_id === id)?.name || null;
  const props = { ...rawProps, figNameOf };
  const players = profiles.map((p) => playerInfo(p, workouts, settings, playerStats));
  const nameOf = (id) => firstName(players.find((p) => p.id === id)?.name ?? 'Ukendt');
  const meFull = profiles.find((p) => p.id === me.id) ?? me;

  const ranked = players.map((p) => ({ id: p.id, name: p.name, prog: weekProgress(workouts, p) }))
    .sort((a, b) => b.prog.pct - a.prog.pct);
  const myProg = weekProgress(workouts, meFull);

  let subtitle = `Du har trænet ${myProg.days} af ${myProg.goal} dage i denne uge.`;
  if (players.length > 1) {
    const pos = ranked.findIndex((r) => r.id === me.id);
    const leader = ranked[0];
    if (leader.prog.pct === 0) subtitle = 'Ugen er helt åben. Hvem kommer først i gang?';
    else if (pos === 0 && ranked[1] && myProg.pct > ranked[1].prog.pct) subtitle = `Du fører ugen med ${pctText(myProg.pct)} af dit mål. Hold farten!`;
    else if (leader.prog.pct === myProg.pct) subtitle = `Du deler førstepladsen med ${pctText(myProg.pct)} af dit mål.`;
    else subtitle = `Du er nr. ${pos + 1} med ${pctText(myProg.pct)} af dit mål. ${firstName(leader.name)} fører med ${pctText(leader.prog.pct)}.`;
  }

  const pendingForMe = workouts
    .filter((w) => w.proof_status === 'pending' && w.user_id !== me.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const mineInfo = players.find((p) => p.id === me.id);

  return (
    <section>
      <h1>Hej {firstName(me.name)}</h1>
      <p className="lead">{subtitle}</p>

      {mineInfo && mineInfo.form.level > 0 && (() => {
        const fig = figNameOf(me.id) || 'Din figur';
        return (
          <button className={`card nudge level-${mineInfo.form.level}`} onClick={() => goLog('walking')}>
            <Figure appearance={props.appearanceOf(me.id)} items={props.items} stats={mineInfo.stats} decay={mineInfo.form.level} size={72} />
            <span>
              <strong>{fig}: {mineInfo.form.label}</strong>
              <span className="sub">
                {mineInfo.form.days} dage uden træning. Én træning – også en gåtur – så er {fig === 'Din figur' ? 'formen' : fig} tilbage med det samme.
              </span>
            </span>
          </button>
        );
      })()}

      {players.length > 1 && <WeekChart players={players} workouts={workouts} />}

      <div className="card quicklog">
        <h3 className="pixel label">Log træning</h3>
        <div className="quickrow">
          {Object.keys(TYPE_LABELS).map((t) => {
            const Icon = TYPE_ICONS[t];
            return (
              <button key={t} className="quickmini" onClick={() => goLog(t)} aria-label={`Log ${TYPE_LABELS[t].toLowerCase()}`}>
                <span className="qicon"><Icon size={24} /></span>
                <span>{TYPE_LABELS[t]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <GoalCard key={`${meFull.goal_set}-${meFull.pending_goal}`} me={meFull} workouts={workouts} refresh={refresh} setError={setError} />

      {pendingForMe.length > 0 && (
        <div className="card attention">
          <h3 className="pixel label">Venter på bekræftelse</h3>
          <p className="sub small">Tryk Bekræft, hvis det ser rigtigt ud. Det første svar tæller.</p>
          {pendingForMe.map((w) => (
            <ConfirmItem key={w.id} w={w} me={me} nameOf={nameOf} settings={settings} refresh={refresh} setError={setError} />
          ))}
        </div>
      )}

      <DuelCard {...props} players={players} />

      {players.length > 1 && <Standings {...props} players={players} />}

      <Feed {...props} players={players} />

    </section>
  );
}

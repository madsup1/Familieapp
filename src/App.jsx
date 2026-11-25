import { useCallback, useEffect, useState } from 'react';
import { Home as HomeIcon, PlusCircle, User, Settings as Gear, LogOut } from 'lucide-react';
import { supabase, configured } from './supabase.js';
import { normalizeSettings, isoWeek, localISO, DEFAULT_APPEARANCE } from './game.js';
import { registerWorker } from './notify.js';
import Auth from './Auth.jsx';
import Home from './Home.jsx';
import Log from './Log.jsx';
import Character from './Character.jsx';
import Settings from './Settings.jsx';

const NAV = [
  ['home', 'Oversigt', HomeIcon],
  ['log', 'Log træning', PlusCircle],
  ['figur', 'Min figur', User],
];

export default function App() {
  const [session, setSession] = useState(null);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState('home');
  const [logType, setLogType] = useState('running');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data: res }) => {
      setSession(res.session);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    const st = await supabase.from('settings').select('*').eq('id', 1).single();
    if (st.error) return setError(st.error.message);
    const settings = normalizeSettings(st.data);
    // Appen viser kun de seneste ~2 måneder; samlet XP kommer fra serveren.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (settings.history_days || 60));
    const res = await Promise.all([
      supabase.from('profiles').select('id, name, is_admin, created_at, weekly_goal, pending_goal, pending_from, goal_set').order('created_at'),
      supabase.from('items').select('*'),
      supabase.from('characters').select('*'),
      supabase.from('workouts').select('*').gte('workout_date', localISO(cutoff)).order('created_at', { ascending: false }).limit(2000),
      supabase.from('duels').select('*').gte('created_at', cutoff.toISOString()).order('created_at', { ascending: false }),
      supabase.rpc('player_stats'),
      supabase.from('cheers').select('*').gte('created_at', cutoff.toISOString()),
    ]);
    const failed = res.find((r) => r.error);
    if (failed) return setError(failed.error.message);
    const [profiles, items, characters, workouts, duels, stats, cheers] = res.map((r) => r.data);
    const playerStats = Object.fromEntries((stats ?? []).map((r) => [r.user_id, r]));
    setData({ profiles, settings, items, characters, workouts, duels, playerStats, cheers });
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  // Registrér at man har kigget forbi, og start service workeren til beskeder.
  useEffect(() => {
    if (!session) return;
    supabase.rpc('touch_seen');
    registerWorker();
  }, [session]);

  if (!configured) return <div className="center"><p>Appen mangler Supabase-nøgler.</p></div>;
  if (!checked) return <div className="center pixel">Indlæser…</div>;
  if (!session) return <Auth />;
  if (!data) return <div className="center">{error ? <p className="error">{error}</p> : <span className="pixel">Indlæser…</span>}</div>;

  const me = data.profiles.find((p) => p.id === session.user.id);
  if (!me) {
    return (
      <div className="center">
        <p>Din spillerprofil findes ikke.</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Log ud</button>
      </div>
    );
  }

  const appearanceOf = (id) => {
    const a = data.characters.find((c) => c.user_id === id)?.appearance;
    return a && Object.keys(a).length ? a : DEFAULT_APPEARANCE;
  };

  const go = (t) => {
    setTab(t);
    window.scrollTo(0, 0);
  };

  const shared = {
    me, ...data, appearanceOf, refresh: load, setError,
    goLog: (type) => { setLogType(type); go('log'); },
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo pixel">Motionsligaen</span>
          <span className="pill">Uge {isoWeek()}</span>
        </div>
        <nav className="topnav">
          {NAV.map(([key, label, Icon]) => (
            <button key={key} className={`navbtn ${tab === key ? 'active' : ''}`} onClick={() => go(key)}>
              <Icon size={22} /> {label}
            </button>
          ))}
        </nav>
        <div className="userbox">
          {me.is_admin && (
            <button className={`iconbtn ${tab === 'settings' ? 'active' : ''}`} onClick={() => go('settings')} aria-label="Indstillinger">
              <Gear size={22} />
            </button>
          )}
          <span className="userchip">
            <span className="avatar pixel">{me.name.charAt(0).toUpperCase()}</span>
            <span className="username">{me.name}</span>
          </span>
          <button className="iconbtn" onClick={() => supabase.auth.signOut()} aria-label="Log ud">
            <LogOut size={22} />
          </button>
        </div>
      </header>

      {error && (
        <div className="error" onClick={() => setError('')}>
          {error} <small>(tryk for at lukke)</small>
        </div>
      )}

      <main>
        {tab === 'home' && <Home {...shared} />}
        {tab === 'log' && <Log key={logType} {...shared} initialType={logType} />}
        {tab === 'figur' && <Character {...shared} />}
        {tab === 'settings' && me.is_admin && <Settings {...shared} />}
      </main>

      <nav className="bottomnav">
        {NAV.map(([key, label, Icon]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => go(key)}>
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

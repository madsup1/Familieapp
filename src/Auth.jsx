import { useState } from 'react';
import { supabase } from './supabase.js';

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const res =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { name } } });
    setBusy(false);
    if (res.error) setMessage(res.error.message);
    else if (mode === 'signup' && !res.data.session) setMessage('Tjek din e-mail og bekræft kontoen, og log så ind.');
  }

  return (
    <div className="center">
      <div className="card auth">
        <h1 className="pixel logo-big">Motionsligaen</h1>
        <p className="sub">{mode === 'login' ? 'Log ind for at træne og dyste.' : 'Opret din spiller.'}</p>
        <form onSubmit={submit} className="stack">
          {mode === 'signup' && (
            <label className="field">
              <span>Navn</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
          )}
          <label className="field">
            <span>E-mail</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Adgangskode</span>
            <input type="password" minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button className="btn primary big pixel" disabled={busy}>
            {mode === 'login' ? 'Log ind' : 'Opret konto'}
          </button>
        </form>
        {message && <p className="notice">{message}</p>}
        <button className="linkbtn" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Ny her? Opret konto' : 'Har du en konto? Log ind'}
        </button>
      </div>
    </div>
  );
}

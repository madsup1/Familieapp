import { useState } from 'react';
import { Hand, MessageCircle } from 'lucide-react';
import { supabase } from './supabase.js';
import { firstName } from './game.js';

export const QUICK_COMMENTS = ['Flot tur!', 'Sejt!', 'Godt gået!', 'Du er en maskine!', 'Respekt!'];

// Gem eller opdatér min high-five (med valgfri kommentar).
export async function giveCheer(workoutId, userId, comment) {
  const clean = (comment || '').trim().slice(0, 140) || null;
  return supabase.from('cheers').upsert({ workout_id: workoutId, user_id: userId, comment: clean }, { onConflict: 'workout_id,user_id' });
}

export function CommentChips({ value, onPick }) {
  return (
    <div className="chips small-chips">
      {QUICK_COMMENTS.map((c) => (
        <button type="button" key={c} className={`chip ${value === c ? 'active' : ''}`} onClick={() => onPick(value === c ? '' : c)}>
          {c}
        </button>
      ))}
    </div>
  );
}

// Viser high-fives og kommentarer på et pas, og lader andre give en.
export default function Cheers({ workout, me, cheers, profiles, refresh, setError }) {
  const mine = cheers.find((c) => c.workout_id === workout.id && c.user_id === me.id);
  const list = cheers.filter((c) => c.workout_id === workout.id);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState(mine?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const nameOf = (id) => firstName(profiles.find((p) => p.id === id)?.name ?? 'Ukendt');
  const isOwn = workout.user_id === me.id;
  const canCheer = !isOwn && workout.proof_status !== 'rejected';

  async function toggle() {
    setBusy(true);
    const { error } = mine
      ? await supabase.from('cheers').delete().eq('workout_id', workout.id).eq('user_id', me.id)
      : await giveCheer(workout.id, me.id, null);
    setBusy(false);
    if (error) setError(error.message);
    else refresh();
  }

  async function saveComment(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await giveCheer(workout.id, me.id, comment);
    setBusy(false);
    if (error) return setError(error.message);
    setOpen(false);
    refresh();
  }

  if (!list.length && !canCheer) return null;

  return (
    <div className="cheers">
      {list.length > 0 && (
        <div className="cheer-list">
          <span className="cheer-names">
            <Hand size={16} /> {list.map((c) => (c.user_id === me.id ? 'Dig' : nameOf(c.user_id))).join(', ')}
          </span>
          {list.filter((c) => c.comment).map((c) => (
            <span key={c.user_id} className="cheer-comment">
              <b>{c.user_id === me.id ? 'Dig' : nameOf(c.user_id)}:</b> {c.comment}
            </span>
          ))}
        </div>
      )}
      {canCheer && (
        <div className="cheer-actions">
          <button type="button" className={`cheerbtn ${mine ? 'active' : ''}`} disabled={busy} onClick={toggle}>
            <Hand size={16} /> {mine ? 'High-five givet' : 'High-five'}
          </button>
          <button type="button" className="cheerbtn" onClick={() => setOpen(!open)}>
            <MessageCircle size={16} /> {mine?.comment ? 'Ret kommentar' : 'Kommentér'}
          </button>
        </div>
      )}
      {open && (
        <form className="cheer-form" onSubmit={saveComment}>
          <CommentChips value={comment} onPick={setComment} />
          <div className="row tight">
            <input value={comment} maxLength={140} placeholder="Skriv en kommentar" onChange={(e) => setComment(e.target.value)} />
            <button className="btn primary pixel" disabled={busy}>Send</button>
          </div>
        </form>
      )}
    </div>
  );
}

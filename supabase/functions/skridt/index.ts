// Modtager dagens skridt fra en iPhone-genvej (Genveje → Sundhed → skridt).
// Kaldes med JSON { "kode": "<personlig kode fra appen>", "skridt": 10234, "dato": "2026-11-25" (valgfri) }.
// Skridtene gemmes som ét automatisk bekræftet pas af typen 'steps' pr. person pr. dag;
// XP beregnes af databasens trigger calc_workout_xp.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

const dkDate = (d = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(d);
const MIN_STEPS = 1000;   // under dette gemmes intet
const MAX_STEPS = 100000; // fejlsikring

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Genveje sender tal med dansk formatering ("10.234" eller "10234,0") – gør dem til et heltal
function toSteps(v: unknown) {
  if (typeof v === "number") return Math.round(v);
  const s = String(v ?? "").trim().replace(/\s/g, "");
  const n = Number(s.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ fejl: "brug POST" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body.kode ?? "").trim().toUpperCase();
    if (!/^[0-9A-F]{12}$/.test(code)) return json({ fejl: "Koden mangler eller er forkert. Hent den under Min figur i appen." }, 401);

    const { data: tok } = await db.from("step_tokens").select("user_id").eq("token_hash", await sha256(code)).maybeSingle();
    if (!tok) return json({ fejl: "Koden passer ikke. Hent en ny under Min figur i appen." }, 401);

    const steps = toSteps(body.skridt);
    if (!Number.isFinite(steps) || steps < 0 || steps > MAX_STEPS) return json({ fejl: "Antal skridt ser forkert ud" }, 400);

    // Kun i dag eller i går (dansk tid)
    const today = dkDate();
    const yesterday = dkDate(new Date(Date.now() - 86400000));
    const day = body.dato ? String(body.dato).slice(0, 10) : today;
    if (day !== today && day !== yesterday) return json({ fejl: "Skridt kan kun sendes for i dag eller i går" }, 400);

    const { data: existing } = await db.from("workouts").select("id, steps")
      .eq("user_id", tok.user_id).eq("type", "steps").eq("workout_date", day).maybeSingle();

    if (existing) {
      // Skridt kan kun gå op i løbet af dagen
      if (steps > (existing.steps ?? 0)) {
        const { error } = await db.from("workouts").update({ steps }).eq("id", existing.id);
        if (error) throw error;
      }
    } else if (steps >= MIN_STEPS) {
      const { error } = await db.from("workouts").insert({
        user_id: tok.user_id, type: "steps", workout_date: day, steps,
        proof_status: "confirmed", confirmed_at: new Date().toISOString(),
      });
      if (error) throw error;
    } else {
      return json({ ok: true, besked: `${steps} skridt er under ${MIN_STEPS}, så der gemmes ikke noget endnu.` });
    }

    const { data: row } = await db.from("workouts").select("steps, xp_awarded")
      .eq("user_id", tok.user_id).eq("type", "steps").eq("workout_date", day).maybeSingle();
    const n = (row?.steps ?? steps).toLocaleString("da-DK");
    return json({ ok: true, besked: `${n} skridt gemt – ${Number(row?.xp_awarded ?? 0)} XP i dag.` });
  } catch (e) {
    return json({ fejl: String((e as Error).message ?? e) }, 500);
  }
});

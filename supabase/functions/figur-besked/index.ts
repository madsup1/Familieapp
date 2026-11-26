// Sender en daglig besked "fra figuren" som push-notifikation, og straks-besked ved ny duel (mode "duel")
// og når en anden spiller logger træning (mode "workout").
// Kaldes af en planlagt opgave (pg_cron) med x-cron-secret, eller af appen (mode "test") med brugerens login.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

const dkDate = (d = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(d);
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
const first = (n?: string | null) => (n || "").split(" ")[0] || "du";
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

async function secrets() {
  const { data, error } = await db.from("app_secrets").select("name, value");
  if (error) throw error;
  const map: Record<string, string> = Object.fromEntries(data.map((r) => [r.name, r.value]));
  if (!map.vapid_public || !map.vapid_private) {
    const keys = webpush.generateVAPIDKeys();
    const { error: insErr } = await db.from("app_secrets").upsert([
      { name: "vapid_public", value: keys.publicKey },
      { name: "vapid_private", value: keys.privateKey },
    ]);
    if (insErr) throw insErr;
    map.vapid_public = keys.publicKey;
    map.vapid_private = keys.privateKey;
  }
  webpush.setVapidDetails("mailto:mulrichpedersen@gmail.com", map.vapid_public, map.vapid_private);
  return map;
}

function formLevel(days: number) {
  if (days >= 7) return 3;
  if (days >= 4) return 2;
  if (days >= 2) return 1;
  return 0;
}

function inactivityMessage(owner: string, fig: string, days: number, rival?: string) {
  const level = formLevel(days);
  const lines: Record<number, string[]> = {
    1: [
      `Hej ${owner}! Det er ${fig}. Mine ben er blevet rastløse – skal vi ud at røre os i dag?`,
      `${owner}, jeg har siddet stille i ${days} dage nu. En lille tur, og jeg er glad igen!`,
    ],
    2: [
      `Øv, ${owner}… jeg kan mærke musklerne svinde efter ${days} dage. Hjælp mig tilbage i form!`,
      `Jeg er blevet lidt rund om maven, ${owner}. Én træning, så er jeg tilbage med det samme.`,
    ],
    3: [
      `${owner}, jeg er officielt blevet sofakartoffel efter ${days} dage. Bare en gåtur – så er jeg mig selv igen!`,
      `Hallo? Det er ${fig}. Jeg har ikke set dagslys i ${days} dage. Skal vi?`,
    ],
  };
  let body = pick(lines[level]);
  if (rival) body += ` ${rival} trænede for nylig, forresten.`;
  return body;
}

async function sendTo(userId: string, title: string, body: string, kind: string) {
  const { data: subs } = await db.from("push_subscriptions").select("*").eq("user_id", userId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body, url: "/" }),
        { TTL: 60 * 60 * 12 }
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
    }
  }
  if (sent) await db.from("notification_log").insert({ user_id: userId, kind, title, body });
  return sent;
}

async function figureName(userId: string) {
  const { data } = await db.from("characters").select("name").eq("user_id", userId).maybeSingle();
  return data?.name || "Din figur";
}

async function runDaily() {
  const today = dkDate();
  const { data: profiles } = await db.from("profiles").select("id, name, created_at");
  const { data: subs } = await db.from("push_subscriptions").select("user_id");
  const subscribed = new Set((subs ?? []).map((s) => s.user_id));
  const since = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
  const twoDaysAgo = dkDate(new Date(Date.now() - 2 * 86400000));
  const { data: st } = await db.from("settings").select("steps_form_min").eq("id", 1).single();
  const formMin = Number(st?.steps_form_min ?? 6000);
  const results: Record<string, string> = {};

  for (const p of profiles ?? []) {
    if (!subscribed.has(p.id)) continue;
    const { count: recent } = await db.from("notification_log").select("id", { count: "exact", head: true })
      .eq("user_id", p.id).gte("sent_at", since).neq("kind", "workout"); // træningsbeskeder spærrer ikke for dagens besked
    if (recent) { results[p.id] = "allerede sendt"; continue; }

    const owner = first(p.name);
    const fig = await figureName(p.id);
    const nameOf = (id: string) => first(profiles!.find((x) => x.id === id)?.name);

    // 1) En duel venter på svar
    const { data: duel } = await db.from("duels").select("challenger_id").eq("opponent_id", p.id)
      .eq("status", "pending").limit(1).maybeSingle();
    if (duel) {
      const body = `${owner}! ${nameOf(duel.challenger_id)} har udfordret os til duel. Skal vi vise dem, hvem der bestemmer?`;
      results[p.id] = `duel: ${await sendTo(p.id, fig, body, "duel")}`;
      continue;
    }

    // 2) Andre venter på, at man bekræfter deres træning
    const { data: pending } = await db.from("workouts").select("user_id, type")
      .eq("proof_status", "pending").neq("user_id", p.id).order("created_at").limit(1).maybeSingle();
    if (pending) {
      const what = pending.type === "running" ? "en løbetur" : pending.type === "strength" ? "et styrkepas" : "en træning";
      const body = `${nameOf(pending.user_id)} venter på, at du bekræfter ${what}. Kig lige forbi, ${owner}!`;
      results[p.id] = `bekræft: ${await sendTo(p.id, fig, body, "confirm")}`;
      continue;
    }

    // 3) For længe siden sidste træning
    // Skridt-pas tæller kun som aktiv dag ved mange skridt (settings.steps_form_min)
    const { data: last } = await db.from("workouts").select("workout_date").eq("user_id", p.id)
      .neq("proof_status", "rejected").or(`type.neq.steps,steps.gte.${formMin}`)
      .order("workout_date", { ascending: false }).limit(1).maybeSingle();
    const lastDate = last?.workout_date ?? dkDate(new Date(p.created_at));
    const days = daysBetween(lastDate, today);
    if (formLevel(days) === 0) { results[p.id] = "i form"; continue; }

    const { data: rivalW } = await db.from("workouts").select("user_id").neq("user_id", p.id)
      .gte("workout_date", twoDaysAgo).neq("proof_status", "rejected").neq("type", "steps").limit(1).maybeSingle();
    const body = inactivityMessage(owner, fig, days, rivalW ? nameOf(rivalW.user_id) : undefined);
    results[p.id] = `form ${formLevel(days)}: ${await sendTo(p.id, fig, body, "inactive")}`;
  }
  return results;
}

// Sendes med det samme, når nogen udfordrer en til duel (kaldes af en trigger på duels).
async function duelChallenge(duelId: string) {
  const { data: d } = await db.from("duels").select("challenger_id, opponent_id, status").eq("id", duelId).maybeSingle();
  if (!d || d.status !== "pending") return { sent: 0, reason: "ingen ventende duel" };
  const { data: profs } = await db.from("profiles").select("id, name").in("id", [d.challenger_id, d.opponent_id]);
  const nameOf = (id: string) => first(profs?.find((x) => x.id === id)?.name);
  const fig = await figureName(d.opponent_id);
  const body = `${nameOf(d.opponent_id)}! ${nameOf(d.challenger_id)} har udfordret os til duel. Åbn appen og tag imod udfordringen!`;
  return { sent: await sendTo(d.opponent_id, `${fig}: Ny duel! ⚔️`, body, "duel") };
}

// Sendes til alle andre spillere, når nogen logger træning (kaldes af en trigger på workouts).
const TYPE_NAMES: Record<string, string> = {
  running: "Løb", walking: "Gåtur", cycling: "Cykling", swimming: "Svømning", strength: "Styrke", other: "Andet",
};
async function workoutPosted(workoutId: string) {
  const { data: w } = await db.from("workouts").select("*").eq("id", workoutId).maybeSingle();
  if (!w || w.type === "steps") return { sent: 0, reason: "intet pas" };
  const { data: profs } = await db.from("profiles").select("id, name");
  const who = first(profs?.find((x) => x.id === w.user_id)?.name);
  const what = w.type === "other" && w.activity ? w.activity : TYPE_NAMES[w.type] ?? "træning";
  const num = (v: unknown) => Number(v).toLocaleString("da-DK");
  const parts = [what];
  if (w.distance_km) parts.push(`${num(w.distance_km)} km`);
  if (w.duration_minutes) parts.push(`${num(w.duration_minutes)} min`);
  const body = `${parts.join(" · ")}. Åbn appen og bekræft – og giv gerne en high five!`;
  let sent = 0;
  for (const p of profs ?? []) {
    if (p.id === w.user_id) continue;
    sent += await sendTo(p.id, `${who} har trænet 💪`, body, "workout");
  }
  return { sent };
}

// Sletter billeder og beskeder ældre end historikken (pas og XP bevares).
async function cleanup() {
  const { data: st } = await db.from("settings").select("history_days").eq("id", 1).single();
  const days = st?.history_days ?? 60;
  const cutoff = dkDate(new Date(Date.now() - days * 86400000));
  let photos = 0;
  for (;;) {
    const { data: old } = await db.from("workouts").select("id, proof_path")
      .not("proof_path", "is", null).lt("workout_date", cutoff).limit(100);
    if (!old?.length) break;
    const { error } = await db.storage.from("proofs").remove(old.map((w) => w.proof_path));
    if (error) throw error;
    const { error: upErr } = await db.from("workouts").update({ proof_path: null }).in("id", old.map((w) => w.id));
    if (upErr) throw upErr;
    photos += old.length;
  }
  await db.from("notification_log").delete().lt("sent_at", new Date(Date.now() - days * 86400000).toISOString());
  return { photos, cutoff };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const keys = await secrets();
    const body = await req.json().catch(() => ({}));
    const mode = body.mode ?? "run";

    if (mode === "test") {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u, error } = await db.auth.getUser(token);
      if (error || !u.user) return json({ error: "ikke logget ind" }, 401);
      const { data: prof } = await db.from("profiles").select("name").eq("id", u.user.id).single();
      const fig = await figureName(u.user.id);
      const msg = `Hej ${first(prof?.name)}, det er ${fig}! Nu kan jeg sige til, når vi skal ud og træne.`;
      const sent = await sendTo(u.user.id, fig, msg, "test");
      return json({ sent });
    }

    if (req.headers.get("x-cron-secret") !== keys.cron_secret) return json({ error: "nej tak" }, 403);
    if (mode === "init") return json({ ok: true });
    if (mode === "cleanup") return json({ ok: true, ...(await cleanup()) });
    if (mode === "workout") return json({ ok: true, ...(await workoutPosted(String(body.workout_id))) });
    if (mode === "duel") return json({ ok: true, ...(await duelChallenge(String(body.duel_id))) });
    return json({ ok: true, results: await runDaily() });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

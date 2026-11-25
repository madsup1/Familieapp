// Push-notifikationer: tilmelding på denne enhed og eksempelbeskeder.
import { supabase } from './supabase.js';
import { firstName } from './game.js';

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function registerWorker() {
  if (import.meta.env.VITE_PREVIEW === '1' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush(userId) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifikationer blev ikke tilladt. Du kan ændre det i telefonens indstillinger.');
  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerWorker());
  if (!reg) throw new Error('Kunne ikke starte notifikationer på denne enhed.');
  await navigator.serviceWorker.ready;
  const { data: key, error } = await supabase.rpc('get_vapid_public');
  if (error || !key) throw new Error('Serveren er ikke klar til notifikationer endnu.');
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  const j = sub.toJSON();
  const { error: insErr } = await supabase.from('push_subscriptions').insert({
    endpoint: j.endpoint, user_id: userId, p256dh: j.keys.p256dh, auth: j.keys.auth,
  });
  if (insErr && insErr.code !== '23505') throw insErr;
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

export async function sendTest() {
  const { data, error } = await supabase.functions.invoke('figur-besked', { body: { mode: 'test' } });
  if (error) throw error;
  return data?.sent ?? 0;
}

// Samme slags beskeder som serveren sender, til forhåndsvisning i appen.
export function sampleMessage(ownerName, figName, level, days) {
  const o = firstName(ownerName);
  const f = figName || 'Din figur';
  const lines = [
    `Hej ${o}, det er ${f}! Nu kan jeg sige til, når vi skal ud og træne.`,
    `Hej ${o}! Det er ${f}. Mine ben er blevet rastløse – skal vi ud at røre os i dag?`,
    `Øv, ${o}… jeg kan mærke musklerne svinde efter ${days} dage. Hjælp mig tilbage i form!`,
    `${o}, jeg er officielt blevet sofakartoffel efter ${days} dage. Bare en gåtur – så er jeg mig selv igen!`,
  ];
  return lines[level] ?? lines[0];
}

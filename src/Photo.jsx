import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from './supabase.js';

// Signerede links til private billeder, genbrugt i en time.
const urlCache = new Map();
async function signedUrl(path) {
  const hit = urlCache.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const { data } = await supabase.storage.from('proofs').createSignedUrl(path, 3600);
  if (!data) return null;
  urlCache.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export function usePhoto(path) {
  const [url, setUrl] = useState(() => urlCache.get(path)?.url ?? null);
  useEffect(() => {
    let alive = true;
    if (path) signedUrl(path).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [path]);
  return url;
}

export function Lightbox({ url, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-label="Billede">
      <button className="iconbtn lightbox-close" onClick={onClose} aria-label="Luk"><X /></button>
      <img src={url} alt="" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

// Lille billede, der åbnes stort ved tryk.
export function PhotoThumb({ path, large = false }) {
  const url = usePhoto(path);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`photothumb ${large ? 'large' : ''}`} onClick={() => url && setOpen(true)} aria-label="Vis billede">
        {url ? <img src={url} alt="" /> : <span>Henter…</span>}
      </button>
      {open && url && <Lightbox url={url} onClose={() => setOpen(false)} />}
    </>
  );
}

// Gør billedet mindre før upload (max 1600 px, JPEG). Falder tilbage til originalen.
export async function shrinkImage(file, max = 1600) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    return blob ? new File([blob], 'billede.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

// Læser hvornår billedet er taget (EXIF/XMP), før det skaleres ned (så forsvinder oplysningerne).
// Giver et Date-objekt i lokal tid, eller null hvis datoen ikke kan læses (fx skærmbilleder).
export async function readPhotoDate(file) {
  try {
    const { default: exifr } = await import('exifr');
    const tags = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate', 'DateCreated'], xmp: true });
    const d = tags?.DateTimeOriginal || tags?.CreateDate || tags?.DateCreated;
    const date = d instanceof Date ? d : d ? new Date(d) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

// "2026-11-25T18:03:00" i lokal tid, til kolonnen photo_taken_at
export function localStamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

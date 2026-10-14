const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  "PlaceFinder/1.0 (+https://google-maps-search-ai.vercel.app)";
const MIN_INTERVAL_MS = 1100;

type Point = { lat: number; lng: number };

const cache = new Map<string, Point | null>();
let queue: Promise<unknown> = Promise.resolve();
let last = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = last + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function lookup(q: string): Promise<Point | null> {
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "1" });
  const res = await fetch(`${ENDPOINT}?${params}`, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    console.error("Nominatim error", res.status);
    return null;
  }
  const data = (await res.json()) as { lat?: string; lon?: string }[];
  const lat = Number(data[0]?.lat);
  const lng = Number(data[0]?.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export async function geocode(q: string): Promise<Point | null> {
  const key = q.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const point = await throttled(() => lookup(q));
    cache.set(key, point);
    if (cache.size > 2000) cache.delete(cache.keys().next().value!);
    return point;
  } catch (err) {
    console.error("Geocoding failed", err);
    return null;
  }
}

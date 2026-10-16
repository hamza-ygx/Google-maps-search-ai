const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const PHOTON = "https://photon.komoot.io/api/";
const USER_AGENT =
  "PlaceFinder/1.0 (+https://google-maps-search-ai.vercel.app)";
const MIN_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 5_000;

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

const point = (lat: unknown, lng: unknown): Point | null => {
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) ? { lat: a, lng: b } : null;
};

async function getJson(url: string, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function nominatim(q: string, timeoutMs: number): Promise<Point | null> {
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "1" });
  const data = (await getJson(`${NOMINATIM}?${params}`, timeoutMs)) as {
    lat?: string;
    lon?: string;
  }[];
  return point(data[0]?.lat, data[0]?.lon);
}

async function photon(q: string, timeoutMs: number): Promise<Point | null> {
  const params = new URLSearchParams({ q, limit: "1" });
  const data = (await getJson(`${PHOTON}?${params}`, timeoutMs)) as {
    features?: { geometry?: { coordinates?: [number, number] } }[];
  };
  const [lng, lat] = data.features?.[0]?.geometry?.coordinates ?? [];
  return point(lat, lng);
}

const reason = (err: unknown) =>
  err instanceof Error ? `${err.name}: ${err.message}` : String(err);

export async function geocode(
  q: string,
  deadline: number,
): Promise<Point | null> {
  const key = q.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  const budget = () => Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now());

  let found: Point | null = null;
  let failed = false;

  if (budget() > 500) {
    try {
      found = await throttled(() => nominatim(q, budget()));
    } catch (err) {
      failed = true;
      console.error("Nominatim failed", reason(err));
    }
  }

  if (!found && budget() > 500) {
    try {
      found = await photon(q, budget());
    } catch (err) {
      failed = true;
      console.error("Photon failed", reason(err));
    }
  }

  if (found || !failed) {
    cache.set(key, found);
    if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  }
  return found;
}

import { NextResponse } from "next/server";
import { HttpError } from "@/lib/errors";
import { geocode } from "@/lib/geocode";
import { parseQuery } from "@/lib/parse";
import { allow } from "@/lib/ratelimit";
import { researchPlaces } from "@/lib/research";
import type { Place, SearchResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(ip)) {
    return fail(429, "Too many searches. Try again in a few minutes.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid request body.");
  }

  const raw = (body as { q?: unknown } | null)?.q;
  const q = typeof raw === "string" ? raw.trim() : "";
  if (q.length < 2 || q.length > 200) {
    return fail(400, "Enter a search between 2 and 200 characters.");
  }

  try {
    const parsed = await parseQuery(q);
    if (!parsed) {
      return fail(
        422,
        'Could not tell what or where to search. Try "cafes in Halmstad".',
      );
    }

    const found = await researchPlaces(parsed, q);

    const places: Place[] = [];
    for (const [i, f] of found.entries()) {
      const point =
        (f.address && (await geocode(f.address))) ||
        (await geocode(`${f.name}, ${parsed.location}`));
      places.push({
        ...f,
        id: `p${i}`,
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
      });
    }

    const result: SearchResponse = { query: parsed, places };
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.message);
    console.error("Search failed", err);
    return fail(500, "Something went wrong. Try again.");
  }
}

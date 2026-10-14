import { HttpError } from "./errors";
import type { Candidate, ParsedQuery } from "./types";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.editorialSummary",
  "places.currentOpeningHours.openNow",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.reviews.text",
].join(",");

type RawPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  websiteUri?: string;
  editorialSummary?: { text?: string };
  currentOpeningHours?: { openNow?: boolean };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  reviews?: { text?: { text?: string } }[];
};

export async function searchPlaces(q: ParsedQuery): Promise<Candidate[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new HttpError(500, "Server is missing GOOGLE_PLACES_API_KEY");

  const textQuery = [...q.qualifiers, q.placeType, "in", q.location].join(" ");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELDS,
    },
    body: JSON.stringify({ textQuery, pageSize: 10, languageCode: "en" }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500);
    console.error("Places API error", res.status, detail);
    throw new HttpError(502, "Place search failed. Try again shortly.");
  }

  const data = (await res.json()) as { places?: RawPlace[] };

  return (data.places ?? []).flatMap((p): Candidate[] => {
    const lat = p.location?.latitude;
    const lng = p.location?.longitude;
    if (!p.id || !p.displayName?.text || lat == null || lng == null) return [];

    return [
      {
        place: {
          id: p.id,
          name: p.displayName.text,
          address: p.formattedAddress ?? "",
          lat,
          lng,
          rating: p.rating ?? null,
          ratingCount: p.userRatingCount ?? null,
          openNow: p.currentOpeningHours?.openNow ?? null,
          weekdayHours: p.regularOpeningHours?.weekdayDescriptions ?? [],
          website: p.websiteUri ?? null,
          mapsUrl: p.googleMapsUri ?? null,
        },
        reviews: (p.reviews ?? [])
          .map((r) => r.text?.text ?? "")
          .filter(Boolean),
        summary: p.editorialSummary?.text ?? null,
      },
    ];
  });
}

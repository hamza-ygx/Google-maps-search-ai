export type ParsedQuery = {
  placeType: string;
  location: string;
  qualifiers: string[];
};

export type Place = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  ratingCount: number | null;
  openNow: boolean | null;
  weekdayHours: string[];
  website: string | null;
  mapsUrl: string | null;
  tip: string;
};

export type Candidate = {
  place: Omit<Place, "tip">;
  reviews: string[];
  summary: string | null;
};

export type SearchResponse = {
  query: ParsedQuery;
  places: Place[];
};

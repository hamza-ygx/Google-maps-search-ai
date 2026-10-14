export type ParsedQuery = {
  placeType: string;
  location: string;
  qualifiers: string[];
};

export type Place = {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  ratingCount: number | null;
  hours: string | null;
  website: string | null;
  source: string | null;
  tip: string;
};

export type Found = Omit<Place, "id" | "lat" | "lng">;

export type SearchResponse = {
  query: ParsedQuery;
  places: Place[];
};

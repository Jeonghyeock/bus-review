export const queryKeys = {
  nearbyStops: (lat: number, lng: number) => ["stops", "nearby", lat, lng] as const,
  arrivals: (stopId: string) => ["stops", stopId, "arrivals"] as const,
  routeReviews: (routeId: string) => ["reviews", "route", routeId] as const,
  stopReviews: (stopId: string) => ["reviews", "stop", stopId] as const,
};

export const queryKeys = {
  arrivals: (stopId: string) => ["stops", stopId, "arrivals"] as const,
};

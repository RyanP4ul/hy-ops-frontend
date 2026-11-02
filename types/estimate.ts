export type EstimateResponse = {
  route: {
    distanceKm: number;
    durationMinutes: number;
    geometry: { type: "LineString"; coordinates: [number, number][] };
  };
  tollDetection: {
    status: "DETECTED" | "NO_TOLL_TAG_FOUND" | "UNAVAILABLE";
    hasToll: boolean | null;
    source: "OpenStreetMap" | "Project OSRM (road-name heuristic)";
    roads: {
      osmWayId: number;
      name: string | null;
      ref: string | null;
      tollTag: string;
      matchedRouteEdges: number;
    }[];
    tollPoints: {
      osmNodeId: number;
      type: "TOLL_BOOTH" | "TOLL_GANTRY";
      name: string | null;
      ref: string | null;
    }[];
    matchedRoadNames: {
      expressway: string;
      name: string | null;
      ref: string | null;
      matchedStepCount: number;
      distanceKm: number;
    }[];
    note: string;
  };
  expenses: {
    driverAllowance: number;
    estimatedFuelLiters: number;
    estimatedFuelCost: number;
    hasToll: boolean | null;
    estimatedTollFee: number | null;
    estimatedTotal: number | null;
    estimatedTotalExcludingUnknownToll: number;
    tollFeeStatus: string;
  };
};

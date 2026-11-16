export type EstimateResponse = {
  route: {
    source: "Google Routes";
    distanceKm: number;
    durationMinutes: number;
    geometry: { type: "LineString"; coordinates: [number, number][] };
    inputPointCount: number;
    routeWaypointCount: number;
    legCount: number;
    isRoundTrip: boolean;
  };
  tollDetection: {
    status: "DETECTED" | "NO_TOLL_EXPECTED";
    hasToll: boolean;
    source: "Google Routes";
    note: string;
  };
  expenses: {
    driverAllowance: number;
    estimatedFuelLiters: number;
    estimatedFuelCost: number;
    hasToll: boolean;
    estimatedTollFee: number | null;
    estimatedTotal: number | null;
    estimatedTotalExcludingUnknownToll: number;
    tollFeeStatus: string;
    fuelConsumptionKmPerLiter: number;
    fuelPricePerLiter: number;
  };
};

import {
  parseRoadRoute,
  roadRouteKey,
  routingWaypointsSchema,
} from "../lib/road-routing";

// Under /panel so the existing session/role proxy protects it.
// Only the server chooses the provider; callers cannot supply an upstream URL.
let demoQueue: Promise<void> = Promise.resolve();

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("waypoints");
  if (!raw || raw.length > 5_000) {
    return Response.json(
      { message: "Provide 2 to 100 valid routing waypoints." },
      { status: 400 },
    );
  }
  const points = routingWaypointsSchema.safeParse(
    raw
      .split(";")
      .map((point) =>
        point
          .split(",")
          .map((value) => (value.trim() === "" ? NaN : Number(value))),
      ),
  );
  if (!points.success) {
    return Response.json(
      { message: "Provide 2 to 100 valid longitude,latitude pairs." },
      { status: 400 },
    );
  }

  const provider = process.env.OSRM_ROUTING_URL?.trim();
  if (!provider && process.env.NODE_ENV === "production") {
    return Response.json(
      {
        message:
          "Road routing is not configured. Set OSRM_ROUTING_URL on the server.",
      },
      { status: 503 },
    );
  }

  try {
    if (!provider) {
      const turn = demoQueue;
      demoQueue = turn.then(
        () => new Promise<void>((resolve) => setTimeout(resolve, 1_100)),
      );
      await turn;
    }
    request.signal.throwIfAborted();
    const url = new URL(
      `${(provider || "https://router.project-osrm.org").replace(/\/$/, "")}/route/v1/driving/${roadRouteKey(points.data)}`,
    );
    url.search = new URLSearchParams({
      geometries: "geojson",
      overview: "full",
      steps: "true",
      alternatives: "false",
      continue_straight: "false",
      radiuses: points.data.map(() => "1000").join(";"),
    }).toString();

    const response = await fetch(url, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error("Routing provider unavailable");
    const route = parseRoadRoute(await response.json(), points.data.length);
    return Response.json(route, {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return Response.json(
      {
        message:
          "Unable to find a driving route. Check the stop locations or try again.",
      },
      { status: 502 },
    );
  }
}

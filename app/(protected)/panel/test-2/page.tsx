"use client";

import { useEffect } from "react";

export default function Page() {
  type Coordinate = [number, number];

  async function geocodeAddress(delivery: {
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
  }): Promise<Coordinate> {
    const params = new URLSearchParams({
      street: delivery.streetAddress,
      city: delivery.city,
      state: delivery.state,
      postalcode: delivery.zipCode,
      country: "Philippines",
      countrycodes: "ph",
      format: "jsonv2",
      limit: "1",
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    );

    if (!response.ok) {
      // throw new Error(
      //   `Failed to geocode address: ${response.status} ${response.statusText}`,
      // );

      console.error(
        `Failed to geocode address: ${response.status} ${response.statusText}`,
      );
      return [0, 0];
    }

    const results = await response.json();

    if (!results.length) {
      throw new Error("Could not find the delivery address.");
    }

    return [Number(results[0].lon), Number(results[0].lat)];
  }

  useEffect(() => {
    console.log(
      JSON.stringify(
        geocodeAddress({
          streetAddress: "123 Main St",
          city: "Makati",
          state: "Metro Manila",
          zipCode: "1234",
        }),
      ),
    );
  }, []);

  return (
    <>
      <h1>Test 2</h1>
    </>
  );
}

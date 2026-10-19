export const DEFAULT_LOCATION: Coordinate = [120.9842, 14.5995];

export const styles = {
  default: undefined,
  openstreetmap3d: "https://tiles.openfreemap.org/styles/liberty",
};

export type StyleKey = keyof typeof styles;

export type Coordinate = [number, number];

export type Destination = {
  id: number;
  name: string;
  description: string;
  coordinate: Coordinate;
};

export type GeocodeResult = {
  place_id: number;
  name: string;
  display_name: string;
  lat: string;
  lon: string;
  addresstype: string;
  address: {
    house_number?: string;
    road?: string;

    neighbourhood?: string;
    suburb?: string;

    village?: string;
    town?: string;
    city?: string;
    municipality?: string;

    province?: string;
    state?: string;

    postcode?: string;

    country?: string;
    country_code?: string;
  };
};

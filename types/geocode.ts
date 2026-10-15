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

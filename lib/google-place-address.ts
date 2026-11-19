export type GooglePlaceAddress = {
  search_address: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
};

export function googlePlaceAddress(place: google.maps.places.Place): GooglePlaceAddress {
  const location = place.location?.toJSON();
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)
    || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) {
    throw new Error("This address has no map location. Choose another result.");
  }
  const component = (...types: string[]) => {
    for (const type of types) {
      const value = place.addressComponents?.find(part => part.types.includes(type))?.longText;
      if (value) return value;
    }
    return "";
  };
  const street = [component("street_number"), component("route")].filter(Boolean).join(" ");
  return {
    search_address: place.formattedAddress ?? "",
    street_address: street || component("premise", "neighborhood", "sublocality_level_1")
      || place.formattedAddress?.split(",")[0]?.trim() || "",
    city: component("locality", "postal_town", "administrative_area_level_3", "sublocality_level_1"),
    // Philippine provinces use level 2; Metro Manila can fall back to level 1.
    state: component("administrative_area_level_2", "administrative_area_level_1"),
    zip_code: component("postal_code"),
    latitude: location.lat,
    longitude: location.lng,
  };
}
